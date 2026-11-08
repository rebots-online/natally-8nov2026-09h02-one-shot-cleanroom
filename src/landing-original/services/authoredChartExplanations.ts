/**
 * Deterministic, authored educational text for chart targets.
 * No network, no LLM, no audio: pure functions over calculated chart facts.
 */
import { resolveChartTarget, chartTargetLabel, isDatedSkyTarget } from './chartTargets';
import { ZODIAC_SIGNS, type NatalChartResult } from './ephemeris';

export type AuthoredExplanation = { title: string; text: string; targets: string[] };

const CONTEXT_LINE = 'Astrology is an interpretive tradition: these meanings grew over centuries as a symbolic language, not as proven predictions about any life.';

const sanitizeName = (raw: string): string =>
  (raw || '').replace(/[\x00-\x1F\x7F]/g, '').replace(/[\[\]{}<>()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

type LessonCore = { what: string; regimes: string; evolution: string; trad: string; why: string; q: string; ancient?: boolean; modern?: boolean };

const BODIES: Record<string, LessonCore> = {
  Sun: {
    ancient: true,
    what: 'The Sun’s chart position marks where the brightest body in the sky stood against the zodiac.',
    regimes: 'Across regimes the Sun’s reading is unusually consistent: Hellenistic astrology counts him the greater light, significator of the mind, the father and honors; medieval practice keeps all that and adds kingship and gold; modern psychological astrology restyles the same center as core identity and vitality.',
    evolution: 'The arc runs from the sun cults of Babylon and Egypt, through Ptolemy’s second-century pairing of the Sun with intellect and soul, to the twentieth-century newspaper columns that made “your Sun sign” shorthand for the whole chart.',
    trad: 'Ancient skywatchers gave the Sun the central role: it was read as the giver of light, vitality and sovereign identity.',
    why: 'The Sun’s daily rising and setting and its yearly drift through the zodiac are the sky’s most regular cycles, and later interpreters connected that steady rhythm with the idea of a stable core self around which a life is organized.',
    q: 'Where in an ordinary week do you feel most fully yourself?',
  },
  Moon: {
    ancient: true,
    what: 'The Moon’s chart position records where the nearest and fastest-moving light traveled through the zodiac.',
    regimes: 'Hellenistic doctrine treats the Moon as the lesser light over the body, the mother and the pulse of fortune, stronger at night; medieval practice keeps her there and adds medicine, timing treatment and diagnosis by her phase; modern psychological work narrows the same field to feeling, habit and security.',
    evolution: 'Her meaning travelled from the calendar-keeper of every early culture, whose face set months, tides and festivals, through the lunar critical days of medieval medicine, to the modern reading of her cycle as the grammar of mood.',
    trad: 'Traditional astrologers tied the Moon to rhythm, mood, memory and daily habit, the tide-like side of a person.',
    why: 'Later interpreters connected its visible behavior with feeling: the Moon waxes and wanes on a reliable monthly pulse and accompanies the tides, so it became the natural emblem of emotions that ebb, flow and return.',
    q: 'Which routines or places help you feel settled when the day has been long?',
  },
  Mercury: {
    ancient: true,
    what: 'Mercury’s chart position shows where the swiftest visible planet, the one that never strays far from the Sun, sat in the zodiac.',
    regimes: 'Mercury is the chameleon of every regime: Hellenistic doctrine calls him convertible, taking the color of whichever planet he keeps company with; medieval practice makes him the planet of clerks, merchants and astrologers themselves; modern astrology keeps him as speech, information and learning style.',
    evolution: 'The lineage runs from the Mesopotamian scribe-god Nabu and Egyptian Thoth, fused into Hermes, through the medieval schools where he ruled grammar and logic, to today’s reading of him as the mind that writes, routes and trades.',
    trad: 'Older traditions cast Mercury as the messenger: speech, trade, travel, wit and the joining of different minds.',
    why: 'Watchers of the sky noticed it darting between evening and morning sky faster than any other wanderer, a fitting picture for a symbol of words, routes and quick exchange.',
    q: 'How do you most like to learn and explain something new?',
  },
  Venus: {
    ancient: true,
    what: 'Venus marks the zodiacal place of the brightest planet, one that ancient people knew as both the evening star and the morning star.',
    regimes: 'Hellenistic astrology counts Venus the lesser benefic of desire, marriage and adornment; medieval doctrine agrees and adds beauty, the arts and the tempering of Mars; modern psychological practice reframes the same attractions as values, relating style and receptivity.',
    evolution: 'She descends from the evening-and-morning star of Ishtar and Aphrodite, whose omens already read differently from city to city; the benefic of marriage became the lady of medieval courtly romance, and the twentieth century fixed her as the love planet of popular astrology.',
    trad: 'Tradition gave Venus the themes of attraction, beauty, affection and value, what a person cherishes and how they draw others near.',
    why: 'Later interpreters connected its gleaming, regular appearances at dusk and dawn with harmony and desire. Recorded omens around Venus actually varied between cultures, so this association is a symbolic tradition rather than a universal observation.',
    q: 'What ordinary beauty did you last stop to notice, and what drew you to it?',
  },
  Mars: {
    ancient: true,
    what: 'Mars’s chart position records where the visibly red planet stood in the zodiac.',
    regimes: 'The older regimes are blunt about Mars: Hellenistic doctrine reads him as war, fire and cutting; medieval practice keeps the hostility but credits his well-placed courage; modern psychology deliberately reverses the valuation, reading him as assertion, drive and the healthy defense of boundaries.',
    evolution: 'From the battlefield omens of Nergal and the Greek Ares, through the medieval soldier and surgeon, his meaning migrated in the twentieth century from destruction to motivation — the same energy re-described as initiative.',
    trad: 'Ancient readings attached drive, courage, competition and heat to Mars, the spark that starts things.',
    why: 'Its uncommon red color and its strange habit of looping backward through the stars set it apart, and later interpreters read that restless motion as a symbol of will, friction and initiative.',
    q: 'When was the last time you fought for something that mattered to you?',
  },
  Jupiter: {
    ancient: true,
    what: 'Jupiter’s chart position marks where the largest visible planet, one of the brightest objects in the night sky, stood in the zodiac.',
    regimes: 'On Jupiter the regimes agree: Hellenistic astrology names him the greater benefic of wealth, children and honor; medieval thought makes him the planet of wise men, lawyers and prelates; modern practice keeps the expansiveness and adds luck, growth and meaning-making.',
    evolution: 'He begins as Marduk, head of the Babylonian pantheon, becomes the presiding star of Hellenistic philosophy, the theology and law of the medieval universities, and ends as the modern symbol of opportunity and the larger life.',
    trad: 'Tradition made Jupiter the great benefic: growth, generosity, learning, travel and trust in life.',
    why: 'Ancient astronomers timed its slow, steady tour of the zodiac at roughly one sign each year, a patient, expansive circuit that suggested abundance, teaching and wide horizons.',
    q: 'What new horizon, big or small, is calling you to stretch a little?',
  },
  Saturn: {
    ancient: true,
    what: 'Saturn’s chart position marks where the slowest planet visible to the naked eye stood in the zodiac.',
    regimes: 'The oldest regimes are severe with Saturn: the greater malefic of loss, delay, old age and want; medieval astrology adds melancholy and the farm; modern humanistic and psychological schools almost invert him into discipline, structure and the teacher found in difficulty.',
    evolution: 'From the Greek Kronos of time and harvest, through the medieval melancholic whose cold dried the body’s humors, to the late twentieth century, when the “Saturn return” near ages twenty-nine and fifty-eight became popular shorthand for hard growth.',
    trad: 'Older texts gave Saturn the hard tasks: time, structure, limits, patience and the rewards of endurance.',
    why: 'Its leisurely thirty-year journey marked the boundary of the ancient-visible sky, and later interpreters read that slow pace as a symbol of rules, consequences and the wisdom that only long effort teaches.',
    q: 'Which long, unglamorous effort in your life has quietly taught you the most?',
  },
  Uranus: {
    modern: true,
    what: 'Uranus was the first planet found with a telescope, spotted in 1781, and its chart position marks where this later-discovered wanderer sat.',
    regimes: 'No ancient regime knows Uranus; after 1781 classical astrologers argued for decades over whether he signified at all, and some traditionalist schools still decline the outer planets; modern psychological and humanistic practice made him a core symbol of invention, shock and liberation.',
    evolution: 'His symbolism is a child of his discovery era: found amid the American and French revolutions and the first electrical science, he was assigned their keywords during the nineteenth century, and the twentieth added individuality, technology and sudden awakening.',
    trad: 'Astrologers of later generations read Uranus as sudden change, invention and the shaking loose of old structures.',
    why: 'The association grew in the era of its discovery, an age of revolutions and rapid science, so its symbolism was drawn from the spirit of that time rather than from any ancient observation.',
    q: 'Where might a little healthy disruption actually free you?',
  },
  Neptune: {
    modern: true,
    what: 'Neptune was recognized as a planet in 1846: its position was predicted mathematically from irregularities in Uranus’s orbit, and it was then found close to that predicted spot. Its chart position marks that far planet’s place.',
    regimes: 'Neptune belongs entirely to modern regimes: no traditional source mentions him, Theosophical writers called him the higher octave of Venus, and psychological astrology adopted him for imagination, dissolution and transcendence; traditionalist revivals mostly leave him out.',
    evolution: 'Predicted by mathematics and found in 1846, he was read through a century that produced photography, anesthetics and séances; film, fantasy and escapism were folded into his meaning across the twentieth century.',
    trad: 'Later astrologers gave Neptune the themes of imagination, dreams, compassion and the dissolving of hard edges.',
    why: 'Its symbolism was assigned in a century of photography, anesthetics and romantic art, so interpreters linked it to altered perception and oceanic feeling rather than to anything visible to the ancients.',
    q: 'What daydream of yours deserves a little more room to breathe?',
  },
  Pluto: {
    modern: true,
    what: 'Pluto was discovered in 1930 at the edge of the known solar system, and its chart position marks that distant body’s place.',
    regimes: 'Pluto is a purely modern symbol with a regime split: depth-psychological astrology made him the planet of the buried — power, compulsion, transformation — while traditionalist schools reject him, and the 2006 astronomical demotion to dwarf planet changed neither camp’s practice.',
    evolution: 'Found in 1930 and named for the lord of the underworld, he absorbed his decade’s languages of the unconscious and hidden power; the 1970s and 1980s recast him as the engine of breakdown and renewal, the transit that restructures a life.',
    trad: 'Modern astrologers read Pluto as deep change: what gets stripped away, transformed and renewed over a lifetime.',
    why: 'The association formed in the decade of its discovery, an age that uncovered hidden forces of matter and power, and interpreters extended that mood into a symbol of buried things rising to be changed.',
    q: 'What change in your life, once unwelcome, turned out to have remade you well?',
  },
  Chiron: {
    modern: true,
    what: 'Chiron, found in 1977, is a small comet-like body traveling between Saturn and Uranus, and its chart position marks where it sat.',
    regimes: 'Chiron has no traditional regime: he entered astrology only after his 1977 discovery, and his “wounded healer” reading is a late-twentieth-century psychological construction used in counseling work rather than in classical technique.',
    evolution: 'His mythic namesake, the wise centaur who taught healers and heroes but could not cure his own wound, supplied the meaning whole; within a decade of discovery, writers such as Zane Stein and Barbara Hand Clow had fixed his counseling use.',
    trad: 'Late-twentieth-century astrologers named Chiron the wounded teacher: the sore place that becomes a source of skill and care for others.',
    why: 'Named for a mythic healer-teacher who could not heal himself, it was assigned a meaning about turning personal difficulty into hard-won wisdom, a modern layer rather than an ancient one.',
    q: 'What hard experience of yours has made you gentler or wiser with others?',
  },
  TrueNode: {
    what: 'The north lunar node is the point where the Moon’s tilted path crosses the Sun’s road through the zodiac, heading northward.',
    regimes: 'The classical regimes read the nodes astronomically, as the eclipse points where the Moon’s path crosses the Sun’s; Indian astrology personifies them as the dragon’s head Rahu and tail Ketu; the growth-direction reading of the north node is a twentieth-century, largely Theosophical and evolutionary-astrology layer.',
    evolution: 'From a predictive marker of where eclipses strike, the nodes were re-read across the late twentieth century as a compass of habit and direction: the south node the worn path, the north node the unfamiliar one.',
    trad: 'Traditional astrologers watched these crossing points closely because eclipses occur near them, and eclipse symbolism carried meanings of interruption, darkening and revelation.',
    why: 'The modern reading of the northward node as a direction of growth and destiny is a later interpretation layered onto that eclipse symbolism; the classical sources themselves gave the nodes an eclipse meaning, not a universal story of fate.',
    q: 'What direction feels unfamiliar but quietly right to you?',
  },
  Ascendant: {
    what: 'The Ascendant is the zodiac degree rising on the eastern horizon at a given moment.',
    regimes: 'Hellenistic practice treats the Ascendant, the horoskopos or hour-marker, as the steering point of the chart — life, body and character; medieval astrology keeps it for constitution and vitality; modern practice makes it persona, style and how a person begins things.',
    evolution: 'The degree rose from a timing mark that fixed the chart to the significator of the whole person, and in twentieth-century popular astrology it joined the “big three” of Sun, Moon and rising.',
    trad: 'Tradition read it as the doorway of the chart: appearance, first impressions and the lens through which a person meets the world.',
    why: 'It earned that role from geometry: it is the point where the sky physically meets the earth for that moment, so interpreters made it the symbol of the interface between a person and their surroundings.',
    q: 'What do you think people sense about you in the first minute, and is it accurate?',
  },
  Midheaven: {
    what: 'The Midheaven is the point where the ecliptic, the Sun’s yearly path, crosses the local meridian, the north–south line passing overhead, at its upper intersection.',
    regimes: 'Hellenistic charts read the tenth place, anchored by the Midheaven, for action, craft and public standing; medieval practice keeps profession and honors; modern astrology narrows the same ground to career and reputation, while whole-sign schools count the tenth place from the Ascendant without needing the angle’s exact degree.',
    evolution: 'Its history is a culminating degree becoming a biography: the point where the Sun stands highest turned into the significator of deeds, then of career, and finally of the modern public self.',
    trad: 'Older astrologers gave it the public summit: vocation, reputation and what a life is visibly known for.',
    why: 'Later interpreters connected that upper-meridian position with the most visible, public part of a life. It is a meridian crossing rather than the zenith or the highest point of the Sun’s arc, and in whole-sign or equal house systems the tenth house does not have to begin exactly at the Midheaven.',
    q: 'What would you love to be known for, ten years from now?',
  },
};

const HOUSE_SYSTEMS_CONTEXT = 'Houses are the numbered sectors of the chart wheel. Different house systems (whole sign, equal, quadrant-based) draw the sector boundaries by different conventions that varied between schools, so a house\u2019s starting degree depends on the system chosen; the first and seventh begin at the Ascendant and Descendant in quadrant and equal systems, and the fourth and tenth align with the IC and Midheaven in quadrant systems. These sectors are topic areas by convention, not fixed regions above or below the horizon.';

const HOUSE_CORES: LessonCore[] = [
  { what: 'The first house is the chart\u2019s first numbered sector, the sector of self and first impressions.', regimes: 'Hellenistic whole-sign practice reads the first place as the hour-marker\u2019s own sector, governing life and body, and the joy of Mercury; medieval quadrant practice keeps it for physique and vitality; modern astrology widens it into identity and first impressions.', evolution: 'The sector began as the anchor from which all the others were counted, kept its body-and-life role through the medieval era, and acquired the modern sense of self-presentation as character reading replaced event prediction.', trad: 'Tradition placed self-image, the body and first impressions here.', why: 'The topics are an inherited convention passed between schools rather than a consequence of sky geometry; later interpreters connect this opening sector with how a life presents itself.', q: 'What first impression do you usually make, and do you like it?' },
  { what: 'The second house is the chart\u2019s second numbered sector.', regimes: 'Hellenistic sources file livelihood and movable possessions under the second place, and medieval practice keeps income and substance; the modern reading keeps property and pay and appends a psychological layer of resources and self-worth.', evolution: 'The topic has drifted little in two thousand years \u2014 goods and livelihood in antiquity remain money and property today \u2014 with only the twentieth-century note about what a person feels they are worth being genuinely new.', trad: 'Older readings gave it money, possessions, talents and the sense of worth a person carries.', why: 'Later interpreters connect this sector with livelihood and what sustains the self; the numbering is a convention that varied by school, not a rule derived from the sky.', q: 'What skill or resource of yours do you most undervalue?' },
  { what: 'The third house is the chart\u2019s third numbered sector.', regimes: 'Hellenistic texts name the third the place of the Good Goddess and assign siblings, short journeys and messages, and it is where the Moon rejoices; medieval practice adds kin, neighbors and letters; modern astrology keeps communications, daily travel and the near environment.', evolution: 'From the classical sector of brothers, roads and rumors, it narrowed toward writing and local movement in the print era, then widened again in modern usage into everyday information exchange of every kind.', trad: 'Tradition read it as the near world: siblings, neighbors, short trips, letters and everyday speech.', why: 'Later interpreters connect the third sector with the everyday circles closest to home; the assignment is an inherited convention, not an observation about direction or place in the sky.', q: 'Who in your daily radius shapes your thinking more than you admit?' },
  { what: 'The fourth house is the chart\u2019s fourth numbered sector.', regimes: 'Hellenistic astrology reads the fourth for parents, ancestors, land and what lies under the earth \u2014 foundations in both senses; medieval practice keeps family, estates and the end of life; modern astrology reads home, roots and private ground.', evolution: 'The underworld corner of the old charts became the landed estate and lineage of medieval practice, and settled in modern times into the psychological sense of home as the base a person stands on.', trad: 'Tradition placed home, ancestry, private foundations and endings here.', why: 'In quadrant systems its cusp is the IC, the lower meridian crossing; other systems simply count sectors from the first. The family symbolism is a later interpretive convention.', q: 'What does home mean to you beyond a place?' },
  { what: 'The fifth house is the chart\u2019s fifth numbered sector.', regimes: 'Hellenistic doctrine names the fifth the place of Good Fortune \u2014 children, pleasure and the gifts of chance \u2014 and the joy of Venus; medieval practice keeps games, feasting and offspring; modern readings fold in romance, creativity and play.', evolution: 'A sector once centered on children and gambling widened through the twentieth century into the standing modern shorthand for self-expression, courtship and creative projects.', trad: 'Older texts gave it pleasure, romance, creativity, play and children.', why: 'Later interpreters connect this sector with what a person brings forth, an inherited symbolic assignment rather than a rule that follows from the house\u2019s position.', q: 'What playful thing did you love as a child that you could revisit?' },
  { what: 'The sixth house is the chart\u2019s sixth numbered sector.', regimes: 'Hellenistic texts call the sixth the place of Bad Fortune \u2014 illness, injury and servitude \u2014 and the joy of Mars; medieval practice keeps infirmity and those who serve; the modern reading deliberately softens the same ground into work routines, service and health habits.', evolution: 'The sickness-and-servants sector of antiquity, retained by medieval medicine, was re-described by twentieth-century astrology as the maintenance department of a life: jobs, habits and the body\u2019s upkeep.', trad: 'Tradition assigned it daily work, health routines, service and craft.', why: 'Later interpreters read this sector as the ordinary machinery of life, the habits that hold a body and schedule together; the meaning was handed down between schools as convention.', q: 'Which small daily habit helps or hinders you most?' },
  { what: 'The seventh house is the chart\u2019s seventh numbered sector, the sector of partnership.', regimes: 'Hellenistic practice reads the seventh, the setting place, for marriage and the partner; medieval astrology keeps spouse and contracts but adds open enemies and lawsuits; modern practice centers committed partnership of every kind.', evolution: 'From the setting sky that marked the classical other, through the medieval sector of marriage and litigation, it became the modern house of one-to-one relationship and what partnership asks in return.', trad: 'Tradition read it as partnership: marriage, contracts, close others and the mirror of relationship.', why: 'It sits opposite the first sector on the wheel, and later interpreters made that opposition the symbol of the significant other; the pairing is an interpretive convention, not a physical property of the sky.', q: 'What do your closest relationships reflect back at you?' },
  { what: 'The eighth house is the chart\u2019s eighth numbered sector.', regimes: 'Hellenistic sources call the eighth the idle place and read it for death and the goods of the dead; medieval practice keeps mortality and inheritance; modern psychological astrology, following twentieth-century writers, re-centers it on shared resources, sexuality and transformation.', evolution: 'The house of endings in the older charts kept its inheritance sense \u2014 other people\u2019s money arriving through death \u2014 and was re-read by the late twentieth century as the workshop of intimacy and change.', trad: 'Older readings gave it shared resources, intimacy, inheritance and deep change.', why: 'Later interpreters connect it, opposite the sector of personal possessions, with what is shared and transformed with others; the assignment is inherited convention.', q: 'Where in life are you ready to let something change form?' },
  { what: 'The ninth house is the chart\u2019s ninth numbered sector.', regimes: 'Hellenistic texts name the ninth the place of God \u2014 dreams, divination and foreign journeys \u2014 and the joy of the Sun; medieval practice makes it the church, the clergy, universities and long travel; modern astrology reads belief, higher study, publishing and the widening of worldview.', evolution: 'The oracular and pilgrimage sector of antiquity became the medieval faculty of theology and law, and ended as the modern address of personal philosophy and meaning.', trad: 'Tradition assigned it long journeys, higher study, philosophy and belief.', why: 'Later interpreters connect this sector with distance, learning and the widening of a worldview, a meaning handed down as convention rather than derived from sky geometry.', q: 'Which belief of yours has changed most in the last five years?' },
  { what: 'The tenth house is the chart\u2019s tenth numbered sector, the sector of vocation and public standing.', regimes: 'Hellenistic practice reads the tenth place, where the Sun culminates, for action, rank and public craft; medieval astrology keeps profession, office and the favor of the great; modern practice makes it career and visible standing \u2014 the regimes agree here more than they differ.', evolution: 'A sector keyed to the Sun\u2019s highest point has kept a public meaning through every regime, sharpening from deeds and honors into the modern idea of vocation.', trad: 'Tradition gave it calling, public standing, vocation and legacy.', why: 'In quadrant systems its cusp is the Midheaven; whole-sign and equal systems count it as the tenth sector from the first, so its starting degree varies by system. The public symbolism is a later interpretive convention.', q: 'What contribution would you like your work to make?' },
  { what: 'The eleventh house is the chart\u2019s eleventh numbered sector.', regimes: 'Hellenistic sources call the eleventh the place of the Good Spirit \u2014 friends, patrons and hopes \u2014 and the joy of Jupiter; medieval practice keeps friends and confidants; modern astrology reads groups, networks, allies and long-range hopes.', evolution: 'The patron-and-friend sector of the classical charts survived as friendship through the medieval era and was widened by the twentieth century into community, collectives and causes.', trad: 'Older texts read it as friendships, groups, hopes and long-range wishes.', why: 'Later interpreters connect it with the community and alliances gathered around a life\u2019s aims, an inherited convention rather than a rule of the sky.', q: 'Which friendship or community quietly holds your hopes?' },
  { what: 'The twelfth house is the chart\u2019s twelfth numbered sector, the last before the wheel returns to the first.', regimes: 'Hellenistic texts call the twelfth the place of the Bad Spirit \u2014 enemies, confinement, exile and loss \u2014 and the joy of Saturn; medieval practice keeps imprisonment, secret foes and misery; the modern psychological reading converts the same enclosure into solitude, retreat and the unconscious.', evolution: 'The most afflicted sector of the old charts has become the modern inner sanctum, naming what works beneath awareness, from hospitals to hermitages to hidden strengths.', trad: 'Tradition placed it as the hidden room: solitude, dreams, retreat and what works beneath awareness.', why: 'Later interpreters connect this closing sector with the inner and the unspoken; the placement and meaning are conventions that varied between schools, not descriptions of above or below the horizon.', q: 'What helps you recharge when you are truly alone?' },
];

const SIGN_CORES: Record<string, LessonCore> = {
  Aries: { what: 'Aries begins the zodiac at the spring equinox point: the first of the three fire signs, of cardinal quality.', regimes: 'Regimes agree on Aries more than on most signs: Hellenistic doctrine makes it the first place, cardinal fire, the domicile of Mars and the exaltation of the Sun; medieval medicine files its heat under the choleric humor; modern psychology reads the same fire as initiative and self-starting.', evolution: 'As the sign of the spring equinox it has opened the tropical zodiac since that zodiac was fixed; it kept its warrior coloring through the medieval bestiaries and emerged in twentieth-century Sun-sign culture as the pioneer.', trad: 'Tradition read Aries as initiative: the spark, the first move, the willingness to begin.', why: 'Starting the yearly circuit at the equinox, when light overtakes dark, made it the natural emblem of new beginnings and boldness.', q: 'What beginning of yours is waiting for a first bold step?' },
  Taurus: { what: 'Taurus is the fixed earth sign of late spring, the season of steady growth.', regimes: 'Hellenistic doctrine gives Taurus fixed earth, the domicile of Venus and the exaltation of the Moon; medieval practice reads its cold, dry earth as stubborn substance; the modern register of steadiness, sensuality and finance changes the vocabulary more than the machinery.', evolution: 'From the plough-ox of the spring fields through the medieval emblem of patient wealth, it became the twentieth century’s money-and-comfort sign — a meaning consolidated when newspaper columns needed one trait per sign.', trad: 'Tradition gave it patience, substance, sensuality and steadfastness.', why: 'Placed in the deep-soil middle of spring, it came to symbolize what is built slowly and kept reliably.', q: 'What in your life deserves more steady, unhurried attention?' },
  Gemini: { what: 'Gemini is the mutable air sign closing spring, the sign of the twins.', regimes: 'Hellenistic sources classify Gemini as a human, double-bodied sign of mutable air, ruled by Mercury; medieval practice reads it as hot and moist, quick and sanguine; modern astrology keeps the doubling as the twin-minded communicator.', evolution: 'The twins Castor and Pollux sailed through older star lore before the sign became a seasonal abstraction; its modern life as curiosity and quickness is a steady simplification of the classical many-mindedness.', trad: 'Tradition read it as curiosity, conversation, versatility and the quick linking of ideas.', why: 'Marking the change of seasons, its twin symbol suited the switching, many-minded energy interpreters gave it.', q: 'Which two sides of you most enjoy a good conversation?' },
  Cancer: { what: 'Cancer is the cardinal water sign opening summer, beginning at the solstice.', regimes: 'Hellenistic doctrine makes Cancer cardinal water, the Moon\u2019s domicile and one of the fruitful signs; medieval practice links its cold, moist nature to the phlegmatic humor; modern astrology reads the shell and the tide as nurture, memory and shelter.', evolution: 'Named for the crab of Greek myth but keyed to the summer solstice, it kept its Moon-governed domestic sense through the medieval era and became the twentieth century\u2019s caretaker archetype.', trad: 'Tradition gave it nurture, memory, shelter and fierce care for what it loves.', why: 'Arriving at the year\u2019s brightest turning point, it was tied to hearth and tide, the protective home of feeling.', q: 'How do you best care for the people you love?' },
  Leo: { what: 'Leo is the fixed fire sign of high summer, ruled in tradition by the Sun.', regimes: 'All regimes give Leo fixed fire and the Sun’s own domicile; classical classifications call it bestial and barren while crediting it with royal fire; medieval medicine reads its heat as choleric vigor; modern astrology keeps the royal note as radiance, play and performance.', evolution: 'From the Nemean lion of Greek star lore and the medieval emblem of sovereignty, it settled into the twentieth century’s performer — the sign of confident creation.', trad: 'Tradition read it as radiance: creativity, generosity, play and warm self-expression.', why: 'Holding the season of strongest light, it became the natural emblem of the shining, sovereign heart.', q: 'What creative spark of yours deserves an audience?' },
  Virgo: { what: 'Virgo is the mutable earth sign closing summer, the season of the harvest.', regimes: 'Hellenistic doctrine gives Virgo mutable earth, Mercury’s domicile and Mercury’s own exaltation; medieval practice reads its cold, dry earth as harvest-time measure and usefulness; modern astrology keeps the sorting gesture as discernment, craft and care.', evolution: 'The wheat-bearing maiden of the late-summer constellation became the medieval symbol of useful labor and, in the twentieth century, the sign of precision and service.', trad: 'Tradition gave it discernment, craft, service and careful refinement.', why: 'Marking harvest time, when grain is sorted and sorted again, it came to symbolize discrimination, usefulness and skill.', q: 'What are you quietly getting better at, piece by piece?' },
  Libra: { what: 'Libra is the cardinal air sign beginning at the autumn equinox, the scales.', regimes: 'Hellenistic sources give Libra cardinal air, the domicile of Venus and the exaltation of Saturn; medieval practice reads it as sanguine balance and the scales of justice; modern astrology keeps the equinoctial evenness as fairness and partnership.', evolution: 'Its stars were first the Scorpion’s claws, only later a separate constellation of Scales — the zodiac’s only inanimate figure — and the modern peacemaker persona grows straight out of that weighing image.', trad: 'Tradition read it as balance: fairness, partnership, beauty and measured judgment.', why: 'Beginning when day and night stand equal, it was a natural emblem of weighing two sides and finding accord.', q: 'Where in your life are you seeking a fairer balance?' },
  Scorpio: { what: 'Scorpio is the fixed water sign of deep autumn.', regimes: 'Hellenistic doctrine makes Scorpio fixed water, the domicile of Mars and one of the fruitful signs; medieval thought reads its still water as hidden depth; the modern register of intensity, loyalty and transformation extends that older secrecy rather than replacing it.', evolution: 'From the scorpion of Greek myth and the claws that once held the Scales, it carried danger and secrecy intact into the twentieth century’s language of depth and change.', trad: 'Tradition gave it depth: intensity, loyalty, transformation and the courage to look at what is hidden.', why: 'Holding the season of deepening dark, interpreters tied it to what goes beneath the surface and returns changed.', q: 'What truth about yourself have you only recently made peace with?' },
  Sagittarius: { what: 'Sagittarius is the mutable fire sign closing autumn, the archer aiming outward.', regimes: 'Hellenistic sources classify Sagittarius as a double-bodied, mutable fire sign — half horse, half archer — and the domicile of Jupiter; medieval practice reads its hot, dry fire as the choleric hunter and traveler; modern astrology keeps the arrow as the search for horizon and meaning.', evolution: 'The centaur archer of the late-autumn constellation kept his mounted, outbound posture through every regime, and the twentieth century gave the figure its modern name: the seeker.', trad: 'Tradition read it as the seeker: travel, philosophy, humor and faith in the wider view.', why: 'Aiming across the turn of the year, it became the emblem of the long horizon and the search for meaning.', q: 'What big question keeps pulling your aim outward?' },
  Capricorn: { what: 'Capricorn is the cardinal earth sign beginning at the winter solstice.', regimes: 'Hellenistic doctrine gives Capricorn cardinal earth, the domicile of Saturn and the exaltation of Mars; late-antique writers paired its solstice with Cancer as the gates of souls; modern astrology reads the same climb as ambition, discipline and mastery.', evolution: 'From the goat-fish emblem of the Babylonian god Ea through the medieval sea-goat of patient ascent, it became the twentieth century\u2019s executive \u2014 the long climb re-told as a career ladder.', trad: 'Tradition gave it ambition, discipline, endurance and the building of lasting things.', why: 'Starting the year\u2019s darkest climb back toward light, it symbolized patient ascent and achievement earned step by step.', q: 'What long climb of yours is worth every careful step?' },
  Aquarius: { what: 'Aquarius is the fixed air sign of deep winter.', regimes: 'Hellenistic practice gives Aquarius fixed air and Saturn’s domicile; modern astrology overlays Uranus as co-ruler after that planet’s discovery and reads the sign as invention and fellowship; traditionalist schools keep Saturn alone — one of the cleanest regime splits in the zodiac.', evolution: 'The water-pourer of the winter sky, giver of rains and floods in old star lore, kept his outflow through the ages; the twentieth century re-read the pitcher as electricity, networks and ideas poured out for everyone.', trad: 'Tradition read it as the visionary: friendship, ideals, invention and loyalty to the collective.', why: 'Holding midwinter with cool clarity, interpreters gave it the picture of ideas and fellowship that outlast the season.', q: 'Which ideal of yours would you defend even when it is unpopular?' },
  Pisces: { what: 'Pisces is the mutable water sign closing the zodiac at winter\u2019s end.', regimes: 'Hellenistic doctrine makes Pisces mutable water, a double-bodied and fruitful sign, the domicile of Jupiter and the exaltation of Venus; medieval practice reads its cold, moist tide as phlegmatic; modern astrology overlays Neptune as co-ruler and reads the fishes as empathy and imagination.', evolution: 'From the Greek myth of Aphrodite and Eros becoming fish to escape Typhon, tied by a cord so as not to lose each other, through the medieval sign of pilgrims and seafarers, it became the twentieth century\u2019s mystic and dreamer.', trad: 'Tradition gave it imagination, empathy, art and the soft dissolving of boundaries.', why: 'Ending the yearly circuit at the edge of spring, it became the emblem of release, dreaming and the tide before renewal.', q: 'Where does your imagination take you when no one is asking?' },
};

const ASPECT_CORES: Record<string, LessonCore> = {
  Conjunction: { what: 'A conjunction occurs when two chart points share nearly the same ecliptic longitude, standing in the same zodiac degree.', regimes: 'Hellenistic doctrine treats the conjunction as co-presence in the same sign, a mixture of the two bodies’ significations; medieval practice sharpens it to bodily joining within orbs, grading conjunctions to the Sun as combustion, under the beams or cazimi; modern astrology reads the same fusion psychologically, as archetypes merged.', evolution: 'What began as two planets simply sharing a place became, by degrees, a measured proximity with tiers of strength, and finally the modern language of blending — the closest thing astrology has to a chord.', trad: 'Tradition read it as a blending: the two symbols speak with one voice, for warmth or for intensity.', why: 'Because the pair share one zodiacal place, interpreters treated the conjunction as the strongest and most fusing of the aspects; the bodies need not appear visually merged, since their ecliptic latitudes can differ.', q: 'Where do two sides of you speak with a single voice?' },
  Opposition: { what: 'An opposition joins two chart points sitting opposite each other, about half the circle apart.', regimes: 'The older regimes treat the opposition as the most estranging figure, a relation of enmity between signs that face each other; medieval doctrine keeps the hostility and asks which planet receives the other; modern psychological astrology re-describes the axis as polarity — two ends of one line demanding integration.', evolution: 'From the classical picture of two significators at war, through the medieval search for reception between them, to the twentieth-century reading of projection and balance: the same geometry, progressively psychologized.', trad: 'Tradition read it as a see-saw: two poles pulling at each other, asking for balance rather than victory.', why: 'The geometry of facing positions across the wheel suggested confrontation and the search for a middle point.', q: 'Which two pulls in your life are asking you to find the middle?' },
  Square: { what: 'A square links two chart points about a quarter of the circle apart, at right angles.', regimes: 'Hellenistic doctrine counts the square among the discordant configurations; medieval teaching gives it the temper of Mars and calls it the quartile; modern practice calls it the growth aspect — friction that builds competence because it is never left alone.', evolution: 'The right angle that once simply obstructed became, in twentieth-century counseling astrology, a deliberately valued difficulty: the aspect credited with building character precisely because it prevents coasting.', trad: 'Tradition read it as friction: a challenge that demands action and, worked with honestly, builds strength.', why: 'The hard right angle of the geometry gave early astrologers a picture of obstacles and productive strain.', q: 'What recurring challenge of yours has quietly made you stronger?' },
  Trine: { what: 'A trine connects two chart points a third of the circle apart, often in the same element.', regimes: 'Hellenistic doctrine treats the trine as the figure of friendship — the same element, the geometry behind the triplicity rulers; medieval practice grades it the strongest benign aspect, of the nature of Jupiter; modern astrology keeps it as ease and inborn talent.', evolution: 'From the triangular grid by which whole schools organized the signs into elements, it narrowed to the chart’s marker of what comes without effort — and modern writers added the caveat that ease can go unspent.', trad: 'Tradition read it as easy flow: talents that arrive without strain, lucky alignments of temperament.', why: 'Same-element thirds share an element in the zodiac, which made interpreters see natural harmony and unforced support.', q: 'Which of your talents feels so natural you forget it is one?' },
  Sextile: { what: 'A sextile joins two chart points a sixth of the circle apart, about sixty degrees.', regimes: 'Hellenistic sources list the sextile among the amicable figures, weaker than the trine; medieval doctrine gives it the nature of Venus — opportunity rather than gift; modern practice keeps exactly that reading: the aspect that must be accepted to work.', evolution: 'The geometry has never changed; only its valuation shifted, from the least of the classical configurations to the twentieth century’s favorite metaphor for the open door that still requires a step.', trad: 'Tradition read it as friendly opportunity: a gentle nudge that works when the person says yes to it.', why: 'Its mild angle suggested acquaintance rather than intensity, an aspect of open doors rather than pushing hands.', q: 'What easy opportunity is waiting for your yes?' },
};

const GENERAL_TITLE = 'How a chart is read';
const GENERAL_LESSON: LessonCore = {
  what: 'A birth chart is a snapshot of the sky, and the sky alone: where the visible and calculated points stood at one moment, mapped onto the zodiac and the houses. Reading it means comparing those calculated positions with an inherited symbolic vocabulary that astrologers have compiled over centuries.',
  regimes: 'Different regimes read this one vocabulary differently: Hellenistic practice judged events through whole signs, sect and the lots; medieval astrology organized everything around dignity, orbs and the humors; modern psychological astrology treats the chart as a description of character and growth. On the grammar itself — planets, signs, houses, aspects — the regimes largely agree.',
  evolution: 'Babylonian omen watchers supplied the planets’ characters, Hellenistic Egypt and Greece fused them into the birth chart about two thousand years ago, Baghdad and then Latin Europe carried the books through the Middle Ages, and the twentieth century re-tooled the whole inheritance into a language of personality.',
  trad: 'That vocabulary began with the seven wandering lights visible to the naked eye, and each planet carried the character ancient observers gave it. Signs colored the expression, houses located it in a department of life, and aspects described the angles between points.',
  why: 'The system grew by observation first and interpretation second: watchers tracked real cycles in the sky, then gradually attached meanings that seemed to fit those rhythms, a tradition built by hand over many generations.',
  q: 'Which part of this symbolic language are you most curious to look at first?',
};

const HOUSE_TOPICS: Array<{ name: string; domain: string }> = [
  { name: 'identity', domain: 'self and first impressions' },
  { name: 'resources', domain: 'money, talents and worth' },
  { name: 'kin', domain: 'kin, neighbors and everyday talk' },
  { name: 'roots', domain: 'home, family and private foundations' },
  { name: 'creation', domain: 'play, romance and creative works' },
  { name: 'craft', domain: 'daily work, health and routines' },
  { name: 'partnership', domain: 'partners and close one-to-one bonds' },
  { name: 'depths', domain: 'intimacy, shared resources and change' },
  { name: 'horizons', domain: 'travel, study and belief' },
  { name: 'summit', domain: 'vocation and public standing' },
  { name: 'collective', domain: 'friends, groups and long hopes' },
  { name: 'sanctuary', domain: 'solitude, dreams and the inner life' },
];

function buildLesson(
  title: string,
  core: LessonCore,
  facts: string,
  nameSentence: string,
  targets: string[]
): AuthoredExplanation {
  const ancientLine = core.ancient
    ? ' This is one of the seven classical planets, watched and named thousands of years before telescopes existed.'
    : core.modern
      ? ' This is a modern discovery: no ancient astrologer knew it existed, and its meaning is a later symbolic assignment, not an ancient tradition.'
      : '';
  const intro = `${nameSentence}${facts ? ' ' + facts : ''} ${core.what}${ancientLine} ${core.regimes} ${core.evolution} ${CONTEXT_LINE}`;
  const middle = `${core.trad} ${core.why}`;
  const closing = `As you sit with this, try it on rather than take it on faith: ${core.q}`;
  return { title, text: [intro, middle, closing].join('\n\n'), targets };
}

function bodyFacts(chart: NatalChartResult, bodyName: string): string {
  const body = chart.natalBodies.find(candidate => candidate.name === bodyName);
  if (!body) return '';
  if (chart.input.birthTimeUnknown) {
    const moonNote = bodyName === 'Moon'
      ? ' The Moon moves quickly, so its exact birth degree could be several degrees away from the value shown.'
      : '';
    return `Because the birth time is unknown, this chart is calculated for noon as an approximation.${moonNote} Houses and angles cannot be determined without a birth time.`;
  }
  const facts = [`Your ${body.name} sits at ${body.fullDegText}`];
  if (Number.isFinite(body.house) && body.house >= 1 && body.house <= 12) {
    facts.push(`in your ${ordinal(body.house)} house`);
  }
  return facts.join(' ') + '.';
}

function resolveDatedTarget(chart: NatalChartResult, canonical: string): { name: string; facts: string } | null {
  if (!isDatedSkyTarget(canonical) || !chart.currentSky) return null;
  const body = chart.currentSky.bodies.find(candidate => candidate.target === canonical);
  const observed = new Date(chart.currentSky.observedAt);
  const observedText = Number.isFinite(observed.getTime()) ? observed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : chart.currentSky.observedAt;
  if (body) {
    const natal = chart.natalBodies.find(candidate => candidate.name === body.name);
    const natalApproximate = body.name === 'Moon' && chart.input.birthTimeUnknown;
    const natalText = natal && !natalApproximate
      ? `, whereas your natal ${body.name} sits at ${natal.fullDegText}`
      : natalApproximate
        ? ', whereas your natal Moon position is an approximation because the birth time is unknown'
        : '';
    return { name: body.name, facts: `As observed at ${observedText}, ${body.name} is at ${body.fullDegText} in the current sky${natalText}. The sky keeps moving; today's position and your birth position are two different photographs, not one placement.` };
  }
  const aspect = chart.currentSky.aspects.find(candidate => candidate.name === canonical);
  if (aspect) {
    const fromBody = chart.currentSky.bodies.find(candidate => candidate.target === aspect.from);
    return { name: aspect.type, facts: `As observed at ${observedText}, ${fromBody?.name ?? chartTargetLabel(aspect.from)} forms a ${aspect.type.toLowerCase()} with your natal ${chartTargetLabel(aspect.to)} (within ${Math.abs(aspect.orb).toFixed(1)}°). This is a temporary sky relationship, not a natal one.` };
  }
  return null;
}

export function getAuthoredChartExplanation(chart: NatalChartResult, target?: string, framing?:string): AuthoredExplanation {
  const name = sanitizeName(chart.input.name);
  const introduction = framing ?? 'Here is the lesson you asked about.';
  const nameSentence = name ? `${name}, ${introduction.charAt(0).toLowerCase()+introduction.slice(1)}` : introduction;
  const canonical = target ? resolveChartTarget(target, chart) : null;
  if (!canonical) {
    return buildLesson(GENERAL_TITLE, GENERAL_LESSON, '', nameSentence, []);
  }
  const label = chartTargetLabel(canonical);

  const dated = resolveDatedTarget(chart, canonical);
  if (dated) {
    const core = BODIES[dated.name] ?? ASPECT_CORES[dated.name] ?? GENERAL_LESSON;
    return buildLesson(`Now: ${label}`, core, dated.facts, nameSentence, [canonical]);
  }

  const natalBody = chart.natalBodies.find(candidate => candidate.name === canonical || candidate.name === label);
  if (natalBody) {
    const core = BODIES[natalBody.name] ?? BODIES[label] ?? null;
    if (core) {
      return buildLesson(`${natalBody.name} in your chart`, core, bodyFacts(chart, natalBody.name), nameSentence, [canonical]);
    }
  }

  const sign = ZODIAC_SIGNS.find(candidate => candidate.name === label || candidate.name === canonical);
  if (sign) {
    const facts = 'Seasonal imagery here comes from the tropical zodiac\u2019s northern-hemisphere origins; the constellations and the local seasons where you live do not match these labels one-to-one.';
    return buildLesson(`${sign.name}, the ${sign.element} sign`, SIGN_CORES[sign.name], facts, nameSentence, [canonical]);
  }

  const houseMatch = /House (\d{1,2})$/i.exec(canonical);
  if (houseMatch) {
    const num = Number(houseMatch[1]);
    if (num >= 1 && num <= 12 && !chart.input.birthTimeUnknown) {
      const topic = HOUSE_TOPICS[num - 1];
      const core = HOUSE_CORES[num - 1];
      return buildLesson(`Your ${ordinal(num)} house`, core, `${HOUSE_SYSTEMS_CONTEXT} Tradition files the ${topic.domain} here.`, nameSentence, [canonical]);
    }
  }

  const aspect = chart.aspectChords.find(candidate => candidate.name === canonical);
  if (aspect) {
    const core = ASPECT_CORES[aspect.type] ?? GENERAL_LESSON;
    const fromBody = chart.natalBodies.find(candidate => candidate.name === aspect.from);
    const toBody = chart.natalBodies.find(candidate => candidate.name === aspect.to);
    const facts = `In your chart, ${aspect.from} ${aspect.type.toLowerCase()} ${aspect.to} (within ${Math.abs(aspect.orb).toFixed(1)}°)${fromBody ? `, with ${aspect.from} at ${fromBody.fullDegText}` : ''}${toBody ? ` and ${aspect.to} at ${toBody.fullDegText}` : ''}.`;
    return buildLesson(`${aspect.from} ${aspect.type.toLowerCase()} ${aspect.to}`, core, facts, nameSentence, [canonical]);
  }

  if (!chart.input.birthTimeUnknown && /^House \d{1,2}$/i.test(label)) return buildLesson(GENERAL_TITLE, GENERAL_LESSON, '', nameSentence, []);
  return buildLesson(GENERAL_TITLE, GENERAL_LESSON, '', nameSentence, []);
}

export function getAuthoredConversationClose(name: string): AuthoredExplanation {
  const safe = sanitizeName(name);
  const greeting = safe ? `${safe}, ` : '';
  const text = [
    `${greeting}I would love to keep going with you, and there are two ways to do that. I can sit with you in a longer guided conversation, where we wander through whatever is on your mind and look at it through your chart together, question by question.`,
    'Or I can compose a personal keepsake reading: a full, written piece about your sky that you can keep, reread and return to whenever you like. Each of these is prepared with real care rather than a quick answer, which is why they are part of the paid offerings; the live quote at checkout shows the current price before you decide anything.',
    'Meanwhile, the free chart right here is still rich: click any planet, sign, house or aspect and I will teach you what the tradition says about it. What would you like to explore together first?',
  ].join('\n\n');
  return { title: 'Explore with Natally', text, targets: [] };
}

export type UpsellCloseVariant = 'default' | 'souvenir';

const UPSELL_CLOSES: Record<UpsellCloseVariant, readonly string[]> = {
  default: [
    'This is the part where I make my one smooth pitch, and I will own it: you have seen the pieces, and a personal reading is where they become your story. Purchase Cr through Top Up, bring the question you actually came with, and I will give it my full attention.',
    'I will say it plainly, because your chart has earned it: the free lessons are the tour, and the personal reading is the sitting. Spend Cr on one and we will read this sky together, question by question, until it is yours.',
    'No countdown timers and no pressure — just confidence: whenever you want the whole picture, purchase Cr through Top Up and ask me for your personal reading. The sky is not going anywhere, and frankly, neither am I.',
  ],
  souvenir: [
    'Here is my favorite kind of sales line, the honest one: let this reading become a souvenir. You keep the PDF, and the persisted interactive vignette frozen in time reopens the atelier exactly as it stood, waiting on your account whenever you want to walk back in.',
    'Some evenings deserve better than a scroll through history. Create your souvenir: the PDF puts the reading in your hands, and the persisted interactive vignette frozen in time keeps the atelier unchanged, ready to re-enter like a room you once stood in.',
    'One confident offer, made once: turn this into a souvenir. The PDF keeps the words; the persisted interactive vignette frozen in time keeps the experience; your account keeps the door unlocked.',
  ],
};
const upsellCloseCursor: Record<UpsellCloseVariant, number> = { default: 0, souvenir: 0 };

/** Frozen authored upsell close for a chart. Pure authored text: no network, no LLM, no audio.
 *  Light in-file rotation per variant so consecutive lessons never repeat the same close verbatim. */
export function getAuthoredUpsellClose(chart: NatalChartResult, variant: 'default' | 'souvenir'): string {
  const lines = UPSELL_CLOSES[variant] ?? UPSELL_CLOSES.default;
  const index = upsellCloseCursor[variant] % lines.length;
  upsellCloseCursor[variant] = (index + 1) % lines.length;
  const safe = sanitizeName(chart.input.name);
  if (!safe) return lines[index];
  const body = /^I\b/.test(lines[index]) ? lines[index] : lines[index].charAt(0).toLocaleLowerCase(undefined) + lines[index].slice(1);
  return `${safe}, ${body}`;
}
