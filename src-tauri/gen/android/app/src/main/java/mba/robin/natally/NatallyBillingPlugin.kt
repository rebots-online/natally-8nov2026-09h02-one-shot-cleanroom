package mba.robin.natally

import android.app.Activity
import android.os.Handler
import android.os.Looper
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import com.revenuecat.purchases.CacheFetchPolicy
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Offerings
import com.revenuecat.purchases.Package as RcPackage
import com.revenuecat.purchases.ProductType
import com.revenuecat.purchases.PurchaseParams
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import com.revenuecat.purchases.PurchasesError
import com.revenuecat.purchases.PurchasesErrorCode
import com.revenuecat.purchases.interfaces.GetVirtualCurrenciesCallback
import com.revenuecat.purchases.interfaces.LogInCallback
import com.revenuecat.purchases.interfaces.PurchaseCallback
import com.revenuecat.purchases.interfaces.ReceiveCustomerInfoCallback
import com.revenuecat.purchases.interfaces.ReceiveOfferingsCallback
import com.revenuecat.purchases.models.StoreTransaction
import com.revenuecat.purchases.virtualcurrencies.VirtualCurrencies
import java.util.ArrayDeque
import java.util.UUID

@InvokeArg
class BillingArgs {
    var ownerUid: String = ""
    var generation: Long = -1
    var publicKey: String = ""
    var kind: String = ""
    var offeringIdentifier: String = ""
    var packageIdentifier: String = ""
    var productIdentifier: String = ""
    var quoteId: String = ""
}

// UX-PLAY-1: all ownership, queue and quote state lives on Android's main thread.
@TauriPlugin
class NatallyBillingPlugin(private val billingActivity: Activity) : Plugin(billingActivity) {
    private val handler = Handler(Looper.getMainLooper())
    private val queue = ArrayDeque<Operation>()
    private var running = false
    private var purchaseBusy = false
    private var desiredOwner: String? = null
    private var desiredGeneration: Long = -1
    private var configuredKey: String? = null
    private data class StoredQuote(val pkg: RcPackage, val owner: String, val generation: Long, val expiresAt: Long)
    private val quotes = mutableMapOf<String, StoredQuote>()

    private fun onMain(block: () -> Unit) { handler.post { block() } }
    private fun desired(args: BillingArgs) = desiredOwner == args.ownerUid && desiredGeneration == args.generation
    private fun current(args: BillingArgs) = desired(args) && Purchases.isConfigured && Purchases.sharedInstance.appUserID == args.ownerUid
    private fun loggingOut(args: BillingArgs) = desiredOwner == null && desiredGeneration == args.generation + 1

    private inner class Operation(val invoke: Invoke, val args: BillingArgs, val command: String) {
        var done = false
        fun callback(block: () -> Unit) = onMain {
            if (!done) try { block() } catch (error: Exception) { fail(error.message ?: "Billing operation failed.") }
        }
        fun finish() {
            if (done) return
            done = true
            if (command == "purchase") purchaseBusy = false
            running = false
            drain()
        }
        fun fail(message: String) {
            if (done) return
            invoke.reject(message)
            finish()
        }
        fun success(data: Map<String, Any?> = emptyMap()) {
            if (done) return
            val valid = if (command == "logout") loggingOut(args) else current(args)
            if (!valid) { fail("The signed-in billing account changed. Refresh access for the current account."); return }
            invoke.resolveObject(data + mapOf("ownerUid" to args.ownerUid, "generation" to args.generation))
            finish()
        }
        fun error(error: PurchasesError) = callback { fail(error.message) }
    }

    private fun submit(invoke: Invoke, command: String) {
        val args = try { invoke.parseArgs(BillingArgs::class.java) } catch (error: Exception) { invoke.reject("Invalid billing arguments."); return }
        onMain {
            if (args.ownerUid.isBlank() || args.generation < 0 || args.generation > 9007199254740990L) {
                invoke.reject("A signed-in owner and valid session generation are required."); return@onMain
            }
            if (command == "configureOwner") {
                if (!args.publicKey.startsWith("goog_") || (configuredKey != null && configuredKey != args.publicKey)) {
                    invoke.reject("A matching configured Google Play public SDK key is required."); return@onMain
                }
                if (args.generation < desiredGeneration || (args.generation == desiredGeneration && desiredOwner != null && desiredOwner != args.ownerUid)) {
                    invoke.reject("Stale billing owner configuration."); return@onMain
                }
                if (!desired(args)) quotes.clear()
                desiredOwner = args.ownerUid
                desiredGeneration = args.generation
                configuredKey = args.publicKey
            } else if (command == "logout") {
                if (!desired(args)) { invoke.reject("Logout belongs to an earlier billing owner."); return@onMain }
                desiredOwner = null
                desiredGeneration = args.generation + 1
                quotes.clear()
            } else if (!desired(args)) {
                invoke.reject("Billing request belongs to an earlier owner."); return@onMain
            }
            if (command == "purchase") {
                if (purchaseBusy) { invoke.reject("Another purchase is already in progress."); return@onMain }
                purchaseBusy = true
            }
            queue.addLast(Operation(invoke, args, command))
            drain()
        }
    }

    private fun drain() {
        if (running || queue.isEmpty()) return
        running = true
        val op = queue.removeFirst()
        try {
            if (op.command == "configureOwner") {
                if (!desired(op.args)) { op.fail("Billing owner changed before configuration."); return }
                configure(op)
            } else if (op.command == "logout") {
                if (!loggingOut(op.args) || !Purchases.isConfigured || Purchases.sharedInstance.appUserID != op.args.ownerUid) {
                    op.fail("Logout belongs to an earlier billing owner."); return
                }
                Purchases.sharedInstance.logOut(object : ReceiveCustomerInfoCallback {
                    override fun onReceived(customerInfo: CustomerInfo) = op.callback { op.success(mapOf("state" to "logged_out")) }
                    override fun onError(error: PurchasesError) = op.error(error)
                })
            } else {
                if (!current(op.args)) { op.fail("Billing is not configured for this owner."); return }
                when (op.command) {
                    "quote" -> quote(op)
                    "purchase" -> purchase(op)
                    "customer", "restore" -> customer(op)
                    "balance" -> balance(op)
                    else -> op.fail("Unknown billing command.")
                }
            }
        } catch (error: Exception) { op.fail(error.message ?: "Billing operation failed.") }
    }

    private fun configure(op: Operation) {
        if (!Purchases.isConfigured) {
            Purchases.configure(PurchasesConfiguration.Builder(billingActivity, op.args.publicKey).appUserID(op.args.ownerUid).build())
            op.success()
        } else if (Purchases.sharedInstance.appUserID == op.args.ownerUid) op.success()
        else Purchases.sharedInstance.logIn(op.args.ownerUid, object : LogInCallback {
            override fun onReceived(customerInfo: CustomerInfo, created: Boolean) = op.callback { op.success() }
            override fun onError(error: PurchasesError) = op.error(error)
        })
    }

    private fun projection(args: BillingArgs, info: CustomerInfo): Map<String, Any?> = mapOf(
        "ownerUid" to args.ownerUid,
        "activeEntitlementIds" to info.entitlements.active.keys.toList(),
        "entitlementExpirations" to info.entitlements.active.mapValues { it.value.expirationDate?.time },
        "purchasedProductIds" to info.allPurchasedProductIds.toList(),
    )

    private fun quote(op: Operation) {
        val args = op.args
        require(args.kind == "reading" || args.kind == "conversation") { "Unknown purchase kind." }
        require(args.offeringIdentifier.isNotBlank() && args.packageIdentifier.isNotBlank() && args.productIdentifier.isNotBlank()) { "Actual Play catalog bindings are required." }
        Purchases.sharedInstance.getOfferings(object : ReceiveOfferingsCallback {
            override fun onError(error: PurchasesError) = op.error(error)
            override fun onReceived(offerings: Offerings) = op.callback {
                require(current(args)) { "Billing account changed while loading the quote." }
                val pkg = offerings.all[args.offeringIdentifier]?.availablePackages?.firstOrNull { it.identifier == args.packageIdentifier }
                    ?: throw IllegalStateException("The configured Play package is unavailable.")
                val product = pkg.product
                require(product.id == args.productIdentifier) { "Play product does not match the configured offer." }
                val type = when (product.type) { ProductType.SUBS -> "subscription"; ProductType.INAPP -> "one_time"; else -> throw IllegalStateException("Unsupported Play product type.") }
                val period = if (type == "subscription") product.period?.iso8601 else null
                require(type != "subscription" || !period.isNullOrBlank()) { "Subscription billing period is unavailable." }
                val price = product.price
                require(price.amountMicros > 0 && price.amountMicros <= 9007199254740991L && Regex("^[A-Z]{3}$").matches(price.currencyCode) && price.formatted.isNotBlank() && product.title.isNotBlank()) { "Play product pricing is unavailable." }
                val now = System.currentTimeMillis()
                quotes.entries.removeAll { it.value.expiresAt <= now }
                val id = UUID.randomUUID().toString()
                val expires = now + 120000
                quotes[id] = StoredQuote(pkg, args.ownerUid, args.generation, expires)
                op.success(mapOf("kind" to args.kind, "quoteId" to id, "packageIdentifier" to pkg.identifier,
                    "productIdentifier" to product.id, "formattedPrice" to price.formatted, "amountMicros" to price.amountMicros,
                    "currency" to price.currencyCode, "expiresAt" to expires, "productType" to type,
                    "billingPeriod" to period, "productTitle" to product.title))
            }
        })
    }

    private fun purchase(op: Operation) {
        val args = op.args
        val quote = quotes.remove(args.quoteId) ?: throw IllegalStateException("This quote was consumed or is no longer available.")
        require(quote.owner == args.ownerUid && quote.generation == args.generation && quote.expiresAt > System.currentTimeMillis()) { "This quote expired or belongs to another account." }
        Purchases.sharedInstance.purchase(PurchaseParams.Builder(billingActivity, quote.pkg).build(), object : PurchaseCallback {
            override fun onCompleted(storeTransaction: StoreTransaction, customerInfo: CustomerInfo) = op.callback {
                op.success(mapOf("state" to "purchased", "customer" to projection(args, customerInfo)))
            }
            override fun onError(error: PurchasesError, userCancelled: Boolean) = op.callback {
                when {
                    userCancelled -> op.success(mapOf("state" to "cancelled"))
                    error.code == PurchasesErrorCode.PaymentPendingError -> op.success(mapOf("state" to "pending"))
                    else -> op.fail(error.message)
                }
            }
        })
    }

    private fun customer(op: Operation) {
        val callback = object : ReceiveCustomerInfoCallback {
            override fun onReceived(customerInfo: CustomerInfo) = op.callback { op.success(mapOf("customer" to projection(op.args, customerInfo))) }
            override fun onError(error: PurchasesError) = op.error(error)
        }
        if (op.command == "restore") Purchases.sharedInstance.restorePurchases(callback)
        else Purchases.sharedInstance.getCustomerInfo(CacheFetchPolicy.FETCH_CURRENT, callback)
    }

    private fun balance(op: Operation) {
        Purchases.sharedInstance.invalidateVirtualCurrenciesCache()
        Purchases.sharedInstance.getVirtualCurrencies(object : GetVirtualCurrenciesCallback {
            override fun onError(error: PurchasesError) = op.error(error)
            override fun onReceived(virtualCurrencies: VirtualCurrencies) = op.callback {
                val roche = virtualCurrencies.all["ROCHE"] ?: throw IllegalStateException("ROCHE balance is unavailable.")
                require(roche.code == "ROCHE" && roche.balance >= 0) { "ROCHE balance is unavailable." }
                op.success(mapOf("currency" to "ROCHE", "balance" to roche.balance, "fetchedAt" to System.currentTimeMillis()))
            }
        })
    }

    @Command fun configureOwner(invoke: Invoke) = submit(invoke, "configureOwner")
    @Command fun quote(invoke: Invoke) = submit(invoke, "quote")
    @Command fun purchase(invoke: Invoke) = submit(invoke, "purchase")
    @Command fun customer(invoke: Invoke) = submit(invoke, "customer")
    @Command fun restore(invoke: Invoke) = submit(invoke, "restore")
    @Command fun balance(invoke: Invoke) = submit(invoke, "balance")
    @Command fun logout(invoke: Invoke) = submit(invoke, "logout")
}
