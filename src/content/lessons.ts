// Authored mini-lessons for every chart body and the chart as a whole.
// Used wherever a placement needs a plain-language introduction: the chat's
// no-allowance fallback, the souvenir report, and the landing example chart.

import type { ChartBodyKey } from '../shared/types';

/** One authored lesson about a chart body (or the chart as a whole). */
export interface Lesson {
  /** Display title, body name first. */
  title: string;
  /** What this placement actually describes, in plain language. */
  what: string;
  /** What the astrological tradition says about it, still plainly. */
  tradition: string;
  /** One reflective question that hands agency back to the reader. */
  question: string;
}

const LESSONS: Record<ChartBodyKey | 'general', Lesson> = {
  general: {
    title: 'The Chart as a Whole',
    what: 'A natal chart is the sky arranged in a circle at the moment you took your first breath — every planet frozen mid-journey, every house holding one room of your life. Read together, it is less a verdict than a map of your native climate: where your energy gathers, where it thins, and how the parts talk to each other. Nothing in it dooms or fixes you; it describes tendencies you get to work with.',
    tradition:
      'Western tropical astrology anchors this map to the equinoxes rather than the visible constellations, so the signs are seasons of the year made psychological. Planets act as functions — doing, feeling, wanting — while signs give each function a style and houses give it a stage. The angles between planets, the aspects, tell you which functions whisper, argue, or sing in harmony.',
    question: 'Looking at your whole wheel, which room of your life feels most ready for a renovation?',
  },
  Sun: {
    title: 'Sun — The Core Flame',
    what: 'The Sun is your vitality and center of gravity: the self you are slowly growing into rather than the role you woke up with. Its sign describes what makes you feel alive, and its house shows the life area where you need to shine for the day to feel like it counted. When your Sun is fed, everything else in the chart has a hearth to gather around.',
    tradition:
      'Classical astrology called the Sun the great significator of the heart and the life force, giving it rulership of Leo and the fifth house of creative self-expression. Its ancient symbol was a dot in a circle — spirit at the center of matter — marking it as both creator and sustainer. Modern practice keeps that thread: the Sun is the quest, not the starting point.',
    question: 'When do you feel most unmistakably, radiantly yourself?',
  },
  Moon: {
    title: 'Moon — The Inner Weather',
    what: 'The Moon is your inner weather: how you feel safe, how you soothe yourself, and what you need when the day turns stormy. Its sign is your emotional dialect and its house is the room of life where moods rise and fall most visibly. Tend it like a garden and the whole chart eats better.',
    tradition:
      'The Moon is the fastest body in the chart, changing signs every two and a half days, which is why an exact birth time matters so much for placing it. Ancient practice made it the significator of memory, bodily rhythms, and the nurturing you received — the ledger of what felt like home. It rules Cancer and the fourth house, the midnight floor of the wheel.',
    question: 'What does your inner weather actually ask for when it rains — comfort, quiet, or company?',
  },
  Mercury: {
    title: 'Mercury — The Messenger',
    what: 'Mercury is how you think, learn, and translate your inner world into words. Its sign styles your reasoning and its house shows where your mind spends most of its day. Know your Mercury and you finally know why some explanations land for you while others bounce off.',
    tradition:
      'As the messenger of the old pantheon, Mercury was the go-between — and physically it plays the part, never straying more than 28 degrees from the Sun in the sky. It rules both Gemini, the gathering of ideas, and Virgo, the sorting of them: the collecting and the filing. Three times a year it appears to move backward, the famous retrograde that tradition reads as a season for review rather than disaster.',
    question: 'Do you make sense of a new idea best by talking it out, writing it down, or teaching it to someone?',
  },
  Venus: {
    title: 'Venus — The Magnet',
    what: 'Venus is what you love, how you love, and the quiet way you draw things toward you. Its sign describes your taste and your language of affection; its house shows where life tends to offer you pleasure and ease. It is also your negotiator — the part of you that prefers honey to hammering.',
    tradition:
      'To the ancients Venus was the lesser benefic, the sweetening influence, ruling Taurus and its sensual abundance along with Libra and its fair exchange. Astronomers know her as the evening and morning star, bright enough to cast shadows, and whether she rose before the Sun or after it was said to color her gifts. Modern astrology reads her as values made visible: what you find beautiful reveals what you truly prize.',
    question: 'What beauty around you feels like it was left there just for you?',
  },
  Mars: {
    title: 'Mars — The Spark',
    what: 'Mars is your spark: how you pursue, compete, get angry, and get back up. Its sign gives your drive a style — flash or slow burn — and its house shows where you spend your courage most often. A well-fed Mars is not aggression; it is the engine under everything else you want.',
    tradition:
      'The old texts called Mars the lesser malefic, not because he is evil but because his heat tests things and sometimes burns them; he ruled Scorpio and its strategy long before modern rulership gave him Aries and its charge. He completes one zodiac lap in about two years, spending roughly two months igniting each sign. Tradition assigns him iron, surgeons, athletes, and anyone whose work demands nerve.',
    question: 'What cause or goal is genuinely worth your anger\u2019s heat this year?',
  },
  Jupiter: {
    title: 'Jupiter — The Expander',
    what: 'Jupiter is where your life keeps saying yes: growth, luck, meaning, and the confidence to reach further. Its sign describes how you make sense of events, its house the territory where doors tend to open when you knock. Its shadow is the same gift overspent — more, more, more until the belt bursts.',
    tradition:
      'Classical astrology named Jupiter the greater benefic, king of the gods, ruling Sagittarius and its horizon-seeking and, traditionally, Pisces and its compassion. He takes about twelve years to circle the zodiac, so the Jupiter returns around ages 12, 24, and 36 often coincide with chapters opening. The old caution was that he magnifies whatever he touches, virtue and excess alike.',
    question: 'Where does your life keep growing every time you show up generous?',
  },
  Saturn: {
    title: 'Saturn — The Long Game',
    what: 'Saturn is the long game: where life asks you to build slowly, keep promises, and grow up on schedule. Its sign describes the kind of authority you are learning to hold, its house the territory that takes decades to truly own. What Saturn presses on early often becomes your sturdiest skill by the second half of life.',
    tradition:
      'The greater malefic to the ancients — lord of time, boundaries, and consequence — Saturn rules Capricorn and, classically, Aquarius. He needs about 29 years for one full orbit, so his famous return near age 29, and again near 58, marks the audit of a life chapter. Tradition\u2019s image is the old man with the scythe: not cruel, simply exact.',
    question: 'Which long game are you quietly willing to play for years without applause?',
  },
  Uranus: {
    title: 'Uranus — The Lightning',
    what: 'Uranus is your lightning rod: the place you are wired to break pattern, experiment, and be unexpectedly yourself. Its sign marks the flavor of a whole generation\u2019s rebellion, its house the personal territory where your life refuses to stay scripted. Its gifts usually arrive as shocks that later look like destiny.',
    tradition:
      'Uranus was discovered in 1781, on the eve of revolutions, and modern astrology handed it rulership of Aquarius — a sign classical astrology still assigns to Saturn. It spends about seven years in each sign and 84 on the whole wheel, so its house placement often says more about you than its sign does. Its axial tilt, rolling around the Sun on its side, became its emblem: the planet that moves differently.',
    question: 'Which of your own tired rules is most overdue for a friendly lightning strike?',
  },
  Neptune: {
    title: 'Neptune — The Dissolver',
    what: 'Neptune is where the edges soften: imagination, compassion, spirituality, and the dreams that pull you past what is provable. Its sign colors a generation\u2019s ideals and its house shows where your boundaries usefully blur — and where wishful thinking can fog the glass. Handled well it is your muse; unhandled it is your daydream leak.',
    tradition:
      'Found by mathematics in 1846 before any telescope confirmed it, Neptune was promptly given rulership of Pisces, the sign of the ocean it is named for. It crawls through the zodiac at fourteen years per sign, so like Uranus and Pluto it speaks loudest through house and aspect. The classical planets had no Neptune; modern practice assigns it the sea\u2019s old portfolio — dreams, glamour, dissolution, and grace.',
    question: 'Where does the line between you and something beautiful usefully blur?',
  },
  Pluto: {
    title: 'Pluto — The Regenerator',
    what: 'Pluto is the deep current: where your life insists on dying and regrowing, wherever power, intimacy, and buried truth live. Its sign marks a generation\u2019s collective underworld, its house the private territory where you are periodically renovated from the foundations up. Plutonian chapters hurt and empower in the same breath.',
    tradition:
      'Discovered in 1930, a decade of secrets and power reshaped, Pluto took Scorpio as its modern rulership while classical astrology keeps Mars there — and when astronomers reclassified it in 2006, astrologers simply kept it. Its 248-year, tilted orbit means generations share its sign while individuals feel it by house and aspect. Its portfolio is Hades\u2019s: wealth under the ground, the unavoidable, and what survives the fire.',
    question: 'What in your life has already died once and come back stronger?',
  },
  Chiron: {
    title: 'Chiron — The Wound That Teaches',
    what: 'Chiron is the old wound that teaches: the early sore spot that never fully closes but slowly becomes your source of wisdom for others. Its sign describes the ache\u2019s theme, its house the life area where it flares — and where your healing gift is forged. What you could not be spared is often what you can uniquely offer.',
    tradition:
      'Chiron was discovered in 1977 among the centaurs, orbiting between Saturn\u2019s structure and Uranus\u2019s disruption — an astronomical bridge to a mythic one, the immortal healer who could cure everyone but himself. Astrology adopted him quickly as the wounded healer, a bridge figure between the visible chart and its invisible costs. His roughly 50-year orbit gives many people a notable Chiron return near that age.',
    question: 'Which old ache, tended gently, has quietly become your expertise?',
  },
  TrueNode: {
    title: 'True Node — The Growth Direction',
    what: 'The True Node points to your growth direction: the unfamiliar edge you are invited toward, while the South Node across the wheel holds the talents you arrived over-equipped with. Its sign describes the lesson\u2019s style, its house the room of life where the stretch happens. Living the node feels awkward at first — that is the compass working.',
    tradition:
      'The nodes are not planets but the two points where the Moon\u2019s path crosses the Sun\u2019s, and the true version wobbles with the Moon\u2019s real motion where the mean version averages it out. Eclipses always occur near these crossings, which is why ancient skywatchers called them the dragon\u2019s head and tail. Vedic astrology builds whole charts around them; Western practice uses them as an axis of appetite versus familiarity.',
    question: 'What unfamiliar room is life inviting you to enter this year, knees shaking and all?',
  },
  Ascendant: {
    title: 'Ascendant — The Doorway',
    what: 'The Ascendant is the doorway others meet you through: the lens, style, and first impression you wear before anyone sees the rooms inside. It shades how all twelve houses fall in your chart and often describes your manner, your look, and your way of beginning things. Strangers likely guess your Ascendant before your Sun.',
    tradition:
      'The rising sign is the zodiac sign cresting the eastern horizon at your exact moment and place of birth, changing roughly every two hours — the reason an accurate birth time is the single most valuable fact in astrology. Classical practice called it the helm of the chart, the steering point from which the houses are numbered. It also names your chart ruler: the planet that captains the whole wheel.',
    question: 'What do people tend to notice about you before you have said a word?',
  },
  Midheaven: {
    title: 'Midheaven — The Summit',
    what: 'The Midheaven is your vocational summit: the public reputation you are built to climb toward and the work you would be proud to be known for. It is less a job title than a direction of visibility — how you want your name to land when it is spoken in rooms you are not in. Its condition colors ambition, legacy, and your private idea of making it.',
    tradition:
      'Medium coeli, the middle of the sky, is the point directly overhead at birth and always anchors the tenth house of career and standing. It moves even faster than the Ascendant — a few degrees can shift it — so it rewards a precise birth time generously. Classical astrologers read it as the seat of honor; modern practice keeps its meaning of public summit and calling.',
    question: 'At the summit of your working life, what do you want to be known for?',
  },
};

/** The authored lesson for a chart body, or for the chart as a whole. */
export function getLesson(bodyKey: ChartBodyKey | 'general'): Lesson {
  return LESSONS[bodyKey];
}
