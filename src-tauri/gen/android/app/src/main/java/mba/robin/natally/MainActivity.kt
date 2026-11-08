package mba.robin.natally

import android.os.Bundle
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private var guideAnimation: AnimatorSet? = null
  private var guideOverlay: FrameLayout? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // UX-PLAY-1: apply real system-bar and IME insets to the content host.
    ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      insets
    }
    val motionEnabled = if (Build.VERSION.SDK_INT >= 26) ValueAnimator.areAnimatorsEnabled()
      else Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) != 0f
    if (savedInstanceState == null && motionEnabled) {
      window.decorView.post { if (!isFinishing && !isDestroyed) showGuidingIntroduction() }
    }
  }

  private fun showGuidingIntroduction() {
    val host = window.decorView as? ViewGroup ?: return
    val overlay = FrameLayout(this).apply {
      setBackgroundColor(Color.rgb(18, 12, 28))
      contentDescription = "Natally points to a glowing point on her natal chart. Tap to continue."
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
      isClickable = true
    }
    val side = (280 * resources.displayMetrics.density).toInt()
    val stage = FrameLayout(this).apply {
      background = GradientDrawable().apply { setColor(Color.rgb(18, 12, 28)); cornerRadius = side * .24f; setStroke(2, Color.rgb(212, 175, 55)) }
      clipToOutline = true
    }
    overlay.addView(stage, FrameLayout.LayoutParams(side, side, Gravity.CENTER))
    overlay.addView(TextView(this).apply {
      text = "v${BuildConfig.VERSION_NAME}"
      setTextColor(Color.rgb(242, 202, 80))
      textSize = 11f
      gravity = Gravity.CENTER
    }, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply { bottomMargin = (32 * resources.displayMetrics.density).toInt() })
    val chart = object : View(this) {
      var focus = 0f
      val ink = Paint(Paint.ANTI_ALIAS_FLAG)
      override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.save(); canvas.scale(width / 100f, height / 100f)
        ink.color = Color.rgb(242, 202, 80); ink.style = Paint.Style.STROKE; ink.strokeWidth = .7f
        canvas.drawCircle(77f, 29f, 22f, ink); canvas.drawCircle(77f, 29f, 17f, ink)
        repeat(12) { canvas.save(); canvas.rotate(it * 30f, 77f, 29f); canvas.drawLine(77f, 7f, 77f, 12f, ink); canvas.restore() }
        ink.color = Color.rgb(192, 132, 252)
        for (line in arrayOf(floatArrayOf(65f,18f,86f,22f), floatArrayOf(86f,22f,73f,39f), floatArrayOf(73f,39f,65f,18f), floatArrayOf(65f,18f,90f,35f), floatArrayOf(90f,35f,73f,39f))) canvas.drawLine(line[0],line[1],line[2],line[3],ink)
        ink.color = Color.argb((focus * 90).toInt(), 255, 216, 107); ink.style = Paint.Style.FILL
        canvas.drawCircle(73f,39f,2f + focus * 4f,ink)
        ink.color = Color.rgb(255,242,174); canvas.drawCircle(73f,39f,2f,ink)
        canvas.restore()
      }
    }
    stage.addView(chart, FrameLayout.LayoutParams(side,side))
    val guide = ImageView(this).apply { setImageResource(R.drawable.natally_guide); scaleType = ImageView.ScaleType.FIT_CENTER }
    stage.addView(guide, FrameLayout.LayoutParams((side * .8f).toInt(), (side * .8f).toInt()).apply { leftMargin = (-side * .05f).toInt(); topMargin = (side * .1f).toInt() })
    guideOverlay = overlay
    host.addView(overlay, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT))
    val move = ObjectAnimator.ofFloat(guide, View.TRANSLATION_X, side * .08f, 0f).apply { duration = 420 }
    val turn = ObjectAnimator.ofFloat(guide, View.ROTATION, -5f, 0f).apply { duration = 420 }
    val appear = ObjectAnimator.ofFloat(guide, View.ALPHA, 0f, 1f).apply { duration = 280 }
    val focus = ValueAnimator.ofFloat(0f,1f,0f).apply { startDelay = 420; duration = 950; addUpdateListener { chart.focus = it.animatedValue as Float; chart.invalidate() } }
    val exit = ObjectAnimator.ofFloat(overlay, View.ALPHA, 1f, 0f).apply { startDelay = 1450; duration = 250 }
    guideAnimation = AnimatorSet().apply {
      playTogether(move, turn, appear, focus, exit)
      addListener(object : AnimatorListenerAdapter() { override fun onAnimationEnd(animation: Animator) { (overlay.parent as? ViewGroup)?.removeView(overlay); guideOverlay = null; guideAnimation = null } })
      start()
    }
    overlay.setOnClickListener { guideAnimation?.cancel() }
  }

  override fun onDestroy() {
    guideAnimation?.cancel()
    guideOverlay?.let { (it.parent as? ViewGroup)?.removeView(it) }
    super.onDestroy()
  }
}
