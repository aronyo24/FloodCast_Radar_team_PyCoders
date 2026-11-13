/**
 * English / Bangla strings - feature F13.
 *
 * One flat table so a translator can work through it top to bottom without
 * reading any component. `{name}` style placeholders are filled by `t()`.
 * District names are not here; they travel with the data (`name_en` /
 * `name_bn`) so both scripts stay correct even if the boundary file changes.
 */

export type Lang = "en" | "bn";

export const LANGS: Lang[] = ["en", "bn"];

export const LANG_LABEL: Record<Lang, string> = { en: "EN", bn: "বাং" };
export const LANG_NAME: Record<Lang, string> = { en: "English", bn: "বাংলা" };

type Entry = { en: string; bn: string };

export const STRINGS = {
  // ---- chrome ---------------------------------------------------------
  "app.name": { en: "FloodCast Radar", bn: "ফ্লাডকাস্ট রাডার" },
  "app.tagline": {
    en: "Monsoon flooding across Bangladesh, district by district",
    bn: "জেলাভিত্তিক বর্ষা বন্যার চিত্র, সারা বাংলাদেশে",
  },
  "nav.home": { en: "Home", bn: "হোম" },
  "nav.explorer": { en: "Flood Explorer", bn: "বন্যা এক্সপ্লোরার" },
  "nav.howItWorks": { en: "How it works", bn: "কীভাবে কাজ করে" },
  "nav.about": { en: "About", bn: "পরিচিতি" },
  "nav.menu": { en: "Menu", bn: "মেনু" },
  "search.placeholder": { en: "Search district", bn: "জেলা খুঁজুন" },
  "search.label": { en: "Search for a district", bn: "জেলা অনুসন্ধান করুন" },
  "search.empty": { en: "No district matches that", bn: "এমন কোনো জেলা নেই" },
  "search.hint": {
    en: "Type a district name in English or Bangla",
    bn: "ইংরেজি বা বাংলায় জেলার নাম লিখুন",
  },
  "lang.switch": { en: "Switch language", bn: "ভাষা পরিবর্তন" },

  "badge.provisional": { en: "Provisional NISAR data", bn: "অস্থায়ী নিসার তথ্য" },
  "badge.provisional.hint": {
    en: "NISAR products are provisional while the mission is being calibrated. Figures can be revised.",
    bn: "নিসার মিশন ক্যালিব্রেশনের সময় তথ্য অস্থায়ী থাকে। সংখ্যা পরিবর্তিত হতে পারে।",
  },
  "badge.demo": { en: "Demo data", bn: "ডেমো তথ্য" },
  "badge.demo.hint": {
    en: "Flood extents in this build are generated for the demo, not measured from NISAR granules. Boundaries, areas and the cycle calendar are real.",
    bn: "এই সংস্করণের বন্যার বিস্তার ডেমোর জন্য তৈরি, নিসার থেকে পরিমাপ করা নয়। সীমানা, আয়তন ও চক্রের তারিখ বাস্তব।",
  },

  "footer.data": { en: "Data", bn: "তথ্যসূত্র" },
  "footer.boundaries": { en: "Boundaries", bn: "সীমানা" },
  "footer.built": { en: "NASA Space Apps Challenge 2026", bn: "নাসা স্পেস অ্যাপস চ্যালেঞ্জ ২০২৬" },
  "footer.challenge": { en: "Dancing with the SARs", bn: "ড্যান্সিং উইথ দ্য সারস" },
  "footer.howItWorks": { en: "How it works", bn: "কীভাবে কাজ করে" },

  // ---- home -----------------------------------------------------------
  "home.eyebrow": { en: "NASA-ISRO NISAR · 2026 monsoon", bn: "নাসা-ইসরো নিসার · ২০২৬ বর্ষা" },
  "home.title": {
    en: "Radar sees the flood through the clouds.",
    bn: "মেঘ ভেদ করেই রাডার বন্যা দেখে।",
  },
  "home.lede": {
    en: "Monsoon clouds hide Bangladesh from ordinary satellites for weeks. NISAR's L-band radar does not care about cloud. FloodCast Radar turns each 12-day radar pass into one number per district: how much of it is under water that should not be there.",
    bn: "বর্ষার মেঘে সাধারণ স্যাটেলাইট সপ্তাহের পর সপ্তাহ বাংলাদেশ দেখতে পায় না। নিসারের এল-ব্যান্ড রাডারের কাছে মেঘ কোনো বাধা নয়। ফ্লাডকাস্ট রাডার প্রতি ১২ দিনের রাডার পাসকে জেলাপ্রতি একটি সংখ্যায় রূপ দেয়: কতটুকু এলাকায় এমন পানি আছে যা থাকার কথা নয়।",
  },
  "home.cta": { en: "Explore the flood map", bn: "বন্যার মানচিত্র দেখুন" },
  "home.ctaSecondary": { en: "How we measure it", bn: "কীভাবে মাপা হয়" },
  "home.headline.label": { en: "Flooded at the 2026 peak", bn: "২০২৬ সালের সর্বোচ্চ বন্যা" },
  "home.headline.sub": {
    en: "of the observed land area, on {date}",
    bn: "পর্যবেক্ষিত ভূমির অংশ, {date} তারিখে",
  },
  "home.worst.label": { en: "Worst-hit district", bn: "সবচেয়ে ক্ষতিগ্রস্ত জেলা" },
  "home.cycles.label": { en: "Radar cycles this season", bn: "এ মৌসুমের রাডার চক্র" },
  "home.districts.label": { en: "Districts tracked", bn: "পর্যবেক্ষিত জেলা" },
  "home.season": { en: "{start} to {end}", bn: "{start} থেকে {end}" },
  "home.risk.eyebrow": { en: "Live outlook", bn: "সরাসরি পূর্বাভাস" },
  "home.risk.title": { en: "Where flooding is most likely in the next 12 days", bn: "আগামী ১২ দিনে কোথায় বন্যার সম্ভাবনা সবচেয়ে বেশি" },
  "home.risk.sub": { en: "Updated after every NISAR radar pass · as of {date}", bn: "প্রতিটি নিসার রাডার পাসের পর হালনাগাদ · {date} অনুযায়ী" },
  "home.risk.all": { en: "See all 64 districts on the map", bn: "মানচিত্রে ৬৪টি জেলাই দেখুন" },
  "home.risk.districts": { en: "districts", bn: "জেলা" },
  "home.features.eyebrow": { en: "What you can do", bn: "আপনি যা করতে পারেন" },
  "home.features.title": { en: "From satellite radar to a warning in your inbox", bn: "স্যাটেলাইট রাডার থেকে আপনার ইনবক্সে সতর্কবার্তা" },
  "home.f1.title": { en: "Live flood map", bn: "সরাসরি বন্যার মানচিত্র" },
  "home.f1.body": { en: "All 64 districts coloured by how much land is under new water, with the raw radar overlay and a season slider.", bn: "নতুন পানির নিচে কতটা জমি তা দিয়ে রাঙানো ৬৪টি জেলা, রাডার ওভারলে ও মৌসুম স্লাইডারসহ।" },
  "home.f2.title": { en: "12-day risk outlook", bn: "১২ দিনের ঝুঁকি পূর্বাভাস" },
  "home.f2.body": { en: "A chance-of-flooding score for every district, with the eight reasons behind it shown openly.", bn: "প্রতিটি জেলার বন্যার সম্ভাবনা স্কোর, পেছনের আটটি কারণ খোলাখুলি দেখানো।" },
  "home.f3.title": { en: "Automatic e-mail alerts", bn: "স্বয়ংক্রিয় ই-মেইল সতর্কবার্তা" },
  "home.f3.body": { en: "Pick your district and level. We e-mail you when the risk rises, with clear steps to take.", bn: "জেলা ও মাত্রা বেছে নিন। ঝুঁকি বাড়লে করণীয়সহ ই-মেইল পাঠাব।" },
  "home.f4.title": { en: "English and বাংলা", bn: "ইংরেজি ও বাংলা" },
  "home.f4.body": { en: "Every screen and safety step in both languages, readable on any phone.", bn: "প্রতিটি পাতা ও নিরাপত্তা নির্দেশনা দুই ভাষায়, যেকোনো ফোনে পড়া যায়।" },
  "home.steps.eyebrow": { en: "How it works", bn: "কীভাবে কাজ করে" },
  "home.s1.title": { en: "Radar sees through cloud", bn: "রাডার মেঘ ভেদ করে দেখে" },
  "home.s1.body": { en: "NASA-ISRO NISAR passes over Bangladesh every 12 days, day or night, monsoon cloud or not.", bn: "নাসা-ইসরো নিসার প্রতি ১২ দিনে বাংলাদেশের উপর দিয়ে যায়, দিন-রাত, মেঘ থাকুক বা না থাকুক।" },
  "home.s2.title": { en: "Water becomes numbers", bn: "পানি হয় সংখ্যা" },
  "home.s2.body": { en: "Smooth water reflects radar away. We map new water and total it district by district.", bn: "মসৃণ পানি রাডার প্রতিফলিত করে দূরে পাঠায়। আমরা নতুন পানি চিহ্নিত করে জেলাভিত্তিক হিসাব করি।" },
  "home.s3.title": { en: "Risk becomes action", bn: "ঝুঁকি থেকে পদক্ষেপ" },
  "home.s3.body": { en: "Trend, history, terrain and season give a 12-day outlook, and alerts reach people in time to act.", bn: "প্রবণতা, ইতিহাস, ভূপ্রকৃতি ও মৌসুম মিলে ১২ দিনের পূর্বাভাস, আর সময়মতো সতর্কবার্তা পৌঁছে যায়।" },
  "home.alert.eyebrow": { en: "Free flood alerts", bn: "বিনামূল্যে বন্যা সতর্কবার্তা" },
  "home.alert.title": { en: "Know before the water comes", bn: "পানি আসার আগেই জানুন" },
  "home.alert.point1": { en: "A welcome e-mail with today's outlook, straight away", bn: "সঙ্গে সঙ্গে আজকের পূর্বাভাসসহ স্বাগত ই-মেইল" },
  "home.alert.point2": { en: "An alert after each radar pass that raises your district's risk", bn: "প্রতিটি রাডার পাসে জেলার ঝুঁকি বাড়লে সতর্কবার্তা" },
  "home.alert.point3": { en: "Clear safety steps, emergency numbers 999 and 1090", bn: "স্পষ্ট নিরাপত্তা নির্দেশনা, জরুরি নম্বর ৯৯৯ ও ১০৯০" },
  "home.alert.point4": { en: "An “all clear” when the water goes down. Unsubscribe any time.", bn: "পানি নামলে “বিপদমুক্ত” বার্তা। যেকোনো সময় আনসাবস্ক্রাইব।" },
  "home.audience.title": { en: "Built for", bn: "কাদের জন্য" },
  "home.audience.1": {
    en: "Disaster managers and NGOs — which districts need help now",
    bn: "দুর্যোগ ব্যবস্থাপক ও এনজিও — এখন কোন জেলায় সাহায্য দরকার",
  },
  "home.audience.2": {
    en: "Journalists and researchers — how the flood spread over the season",
    bn: "সাংবাদিক ও গবেষক — পুরো মৌসুমে বন্যা কীভাবে ছড়িয়েছে",
  },
  "home.audience.3": {
    en: "Citizens and students — was my district flooded, and when",
    bn: "নাগরিক ও শিক্ষার্থী — আমার জেলা কবে প্লাবিত হয়েছিল",
  },

  // ---- explorer: key numbers -----------------------------------------
  "cards.totalFlooded": { en: "Total flooded area", bn: "মোট প্লাবিত এলাকা" },
  "cards.totalFlooded.hint": {
    en: "Land classified as new water in this cycle, summed over every district the radar observed. Permanent rivers and beels are excluded.",
    bn: "এই চক্রে নতুন পানি হিসেবে শনাক্ত ভূমি, রাডারে দেখা সব জেলার যোগফল। স্থায়ী নদী ও বিল এর বাইরে।",
  },
  "cards.worstDistrict": { en: "Worst district", bn: "সবচেয়ে ক্ষতিগ্রস্ত জেলা" },
  "cards.worstDistrict.hint": {
    en: "Highest share of observed area under new water in this cycle.",
    bn: "এই চক্রে পর্যবেক্ষিত এলাকার সবচেয়ে বেশি অংশ নতুন পানির নিচে।",
  },
  "cards.districtsSeen": { en: "Districts observed", bn: "পর্যবেক্ষিত জেলা" },
  "cards.districtsSeen.hint": {
    en: "Districts with usable radar coverage in this cycle. The rest are grey on the map — no image, not no flood.",
    bn: "এই চক্রে ব্যবহারযোগ্য রাডার কভারেজ পাওয়া জেলা। বাকিগুলো মানচিত্রে ধূসর — ছবি নেই, বন্যা নেই এমন নয়।",
  },
  "cards.latestImage": { en: "Latest image", bn: "সর্বশেষ ছবি" },
  "cards.latestImage.hint": {
    en: "Acquisition date of the most recent radar pass in the dataset. New data is checked for daily, but NISAR revisits only about every 12 days, so most checks correctly find nothing new.",
    bn: "ডেটাসেটের সর্বশেষ রাডার পাসের তারিখ। প্রতিদিন নতুন তথ্য যাচাই করা হয়, কিন্তু নিসার প্রায় ১২ দিনে একবার আসে, তাই বেশিরভাগ যাচাইয়ে নতুন কিছু পাওয়া যায় না।",
  },
  "cards.ofObserved": { en: "{pct} of observed land", bn: "পর্যবেক্ষিত ভূমির {pct}" },
  "cards.lastChecked": { en: "Last checked {when}", bn: "সর্বশেষ যাচাই {when}" },
  "cards.coverageNote": {
    en: "Cycle {date} · {pct} of the country observed",
    bn: "{date} চক্র · দেশের {pct} পর্যবেক্ষিত",
  },

  // ---- explorer: alerts ----------------------------------------------
  "alert.severe": { en: "Severe flooding", bn: "তীব্র বন্যা" },
  "alert.warning": { en: "Flood warning", bn: "বন্যা সতর্কতা" },
  "alert.above": {
    en: "{names} above alert level in cycle {date}",
    bn: "{date} চক্রে {names} সতর্কতা মাত্রার উপরে",
  },
  "alert.none": {
    en: "No district above the {pct} alert level in cycle {date}",
    bn: "{date} চক্রে কোনো জেলা {pct} সতর্কতা মাত্রা ছাড়ায়নি",
  },
  "alert.more": { en: "and {n} more", bn: "এবং আরও {n}টি" },
  "alert.jumpToPeak": { en: "Jump to season peak", bn: "মৌসুমের সর্বোচ্চে যান" },

  // ---- explorer: controls --------------------------------------------
  "slider.label": { en: "Radar cycle", bn: "রাডার চক্র" },
  "slider.aria": {
    en: "Radar cycle date. Use arrow keys to step through the season.",
    bn: "রাডার চক্রের তারিখ। মৌসুম জুড়ে যেতে তীর চিহ্ন ব্যবহার করুন।",
  },
  "slider.play": { en: "Play season", bn: "মৌসুম চালান" },
  "slider.pause": { en: "Pause", bn: "থামান" },
  "slider.prev": { en: "Previous cycle", bn: "আগের চক্র" },
  "slider.next": { en: "Next cycle", bn: "পরের চক্র" },
  "slider.cycleOf": { en: "Cycle {n} of {total}", bn: "চক্র {n} / {total}" },

  "map.aria": {
    en: "Map of Bangladesh districts coloured by share flooded. Use the ranking list or the district search to select a district with the keyboard.",
    bn: "প্লাবিত অংশ অনুযায়ী রঙ করা বাংলাদেশের জেলা মানচিত্র। কীবোর্ড দিয়ে জেলা বাছতে তালিকা বা অনুসন্ধান ব্যবহার করুন।",
  },
  "overlay.title": { en: "Radar overlay", bn: "রাডার ওভারলে" },
  "overlay.show": { en: "Show flood overlay", bn: "বন্যার ওভারলে দেখান" },
  "overlay.hint": {
    en: "Draws the pixel-level water mask on top of the district colours.",
    bn: "জেলার রঙের উপরে পিক্সেল পর্যায়ের পানির মাস্ক আঁকে।",
  },
  "overlay.basemap": { en: "Street basemap", bn: "রাস্তার বেসম্যাপ" },
  "overlay.basemap.hint": {
    en: "Loads map tiles from the internet. Leave this off for an offline demo.",
    bn: "ইন্টারনেট থেকে টাইল লোড করে। অফলাইন ডেমোর জন্য বন্ধ রাখুন।",
  },

  // ---- legend ---------------------------------------------------------
  "legend.title": { en: "Share of district flooded", bn: "জেলার কত অংশ প্লাবিত" },
  "legend.none": { en: "Little or none", bn: "নগণ্য বা নেই" },
  "legend.moderate": { en: "Moderate", bn: "মাঝারি" },
  "legend.severe": { en: "Severe", bn: "তীব্র" },
  "legend.extreme": { en: "Extreme", bn: "অতি তীব্র" },
  "legend.notObserved": { en: "Not observed", bn: "পর্যবেক্ষণ হয়নি" },
  "legend.partial": { en: "Partly observed (under 50%)", bn: "আংশিক পর্যবেক্ষিত (৫০% এর কম)" },
  "legend.overlayFlood": { en: "New water", bn: "নতুন পানি" },
  "legend.overlayWater": { en: "Normal water", bn: "স্বাভাবিক পানি" },

  // ---- ranking --------------------------------------------------------
  "ranking.title": { en: "Most flooded", bn: "সর্বাধিক প্লাবিত" },
  "ranking.subtitle": { en: "Top 10 in this cycle", bn: "এই চক্রের শীর্ষ ১০" },
  "ranking.empty": { en: "Nothing observed in this cycle", bn: "এই চক্রে কিছু পর্যবেক্ষণ হয়নি" },
  "ranking.hint": { en: "Select a district to zoom the map", bn: "মানচিত্র জুম করতে জেলা বেছে নিন" },

  // ---- district panel / page -----------------------------------------
  "panel.empty.title": { en: "Pick a district", bn: "একটি জেলা বেছে নিন" },
  "panel.empty.body": {
    en: "Click any district on the map, or choose one from the ranking, to see its numbers and its season.",
    bn: "মানচিত্রে যেকোনো জেলায় ক্লিক করুন, বা তালিকা থেকে বেছে নিন — তার সংখ্যা ও পুরো মৌসুম দেখতে।",
  },
  "panel.flooded": { en: "Flooded", bn: "প্লাবিত" },
  "panel.floodedArea": { en: "Flooded area", bn: "প্লাবিত এলাকা" },
  "panel.coverage": { en: "Radar coverage", bn: "রাডার কভারেজ" },
  "panel.coverage.hint": {
    en: "How much of the district this cycle's radar pass actually saw. Percentages are of the observed part only.",
    bn: "এই চক্রের রাডার পাস জেলার কতটুকু আসলে দেখেছে। শতাংশ কেবল পর্যবেক্ষিত অংশের।",
  },
  "panel.area": { en: "District area", bn: "জেলার আয়তন" },
  "panel.permanentWater": { en: "Permanent water", bn: "স্থায়ী জলাশয়" },
  "panel.seasonPeak": { en: "Season peak", bn: "মৌসুমের সর্বোচ্চ" },
  "panel.rank": { en: "Rank this cycle", bn: "এই চক্রে অবস্থান" },
  "panel.openFull": { en: "Open district page", bn: "জেলার পাতা খুলুন" },
  "panel.notObserved.title": { en: "Not observed", bn: "পর্যবেক্ষণ হয়নি" },
  "panel.notObserved.body": {
    en: "No usable radar frame covered this district in this cycle. That is missing information, not an absence of flooding.",
    bn: "এই চক্রে ব্যবহারযোগ্য রাডার ফ্রেম এই জেলাকে ঢাকেনি। এটি তথ্যের অভাব, বন্যা না থাকার প্রমাণ নয়।",
  },
  "panel.partly": {
    en: "Only {pct} of this district was observed — treat the figure as a lower bound.",
    bn: "এই জেলার মাত্র {pct} পর্যবেক্ষণ হয়েছে — সংখ্যাটিকে ন্যূনতম ধরুন।",
  },

  "district.back": { en: "Back to the explorer", bn: "এক্সপ্লোরারে ফিরুন" },
  "district.division": { en: "{name} Division", bn: "{name} বিভাগ" },
  "district.latestCycle": { en: "Latest cycle", bn: "সর্বশেষ চক্র" },
  "district.timeline.title": { en: "This district through the season", bn: "পুরো মৌসুমে এই জেলা" },
  "district.timeline.sub": {
    en: "Share of the observed area under new water, per 12-day cycle",
    bn: "প্রতি ১২ দিনের চক্রে পর্যবেক্ষিত এলাকার কত অংশ নতুন পানির নিচে",
  },
  "district.coverage.title": { en: "Coverage by cycle", bn: "চক্রভিত্তিক কভারেজ" },
  "district.coverage.sub": {
    en: "How much of the district each radar pass saw",
    bn: "প্রতিটি রাডার পাস জেলার কতটুকু দেখেছে",
  },
  "district.compare.title": { en: "Before and after", bn: "আগে ও পরে" },
  "district.compare.sub": {
    en: "Drag the handle to compare the first cycle of the season with this district's peak",
    bn: "হাতলটি টেনে মৌসুমের প্রথম চক্রের সাথে এই জেলার সর্বোচ্চ অবস্থার তুলনা করুন",
  },
  "district.compare.before": { en: "Before", bn: "আগে" },
  "district.compare.after": { en: "Peak", bn: "সর্বোচ্চ" },
  "district.compare.aria": {
    en: "Before and after comparison slider. Use arrow keys to move the divider.",
    bn: "আগে ও পরের তুলনার স্লাইডার। বিভাজক সরাতে তীর চিহ্ন ব্যবহার করুন।",
  },
  "district.nearby": { en: "Neighbouring districts", bn: "পার্শ্ববর্তী জেলা" },
  "district.regime": { en: "Flood setting", bn: "বন্যার ধরন" },

  // ---- national timeline ---------------------------------------------
  "timeline.title": { en: "National flooded area", bn: "জাতীয় প্লাবিত এলাকা" },
  "timeline.sub": {
    en: "Estimated km² of new water per 12-day radar cycle",
    bn: "প্রতি ১২ দিনের রাডার চক্রে আনুমানিক বর্গকিমি নতুন পানি",
  },
  "timeline.selected": { en: "Selected cycle", bn: "নির্বাচিত চক্র" },
  "timeline.axis": { en: "km² flooded", bn: "বর্গকিমি প্লাবিত" },

  // ---- actions --------------------------------------------------------
  "action.csv": { en: "Download CSV", bn: "সিএসভি ডাউনলোড" },
  "action.csv.hint": {
    en: "The numbers behind the current view, one row per district.",
    bn: "বর্তমান দৃশ্যের সংখ্যাগুলো, প্রতি জেলায় একটি সারি।",
  },
  "action.copyLink": { en: "Copy link to this view", bn: "এই দৃশ্যের লিংক কপি" },
  "action.copied": { en: "Link copied", bn: "লিংক কপি হয়েছে" },
  "action.update": { en: "Check for new images", bn: "নতুন ছবি খুঁজুন" },
  "action.update.running": { en: "Checking for new data…", bn: "নতুন তথ্য যাচাই হচ্ছে…" },
  "action.update.auth": {
    en: "Staff sign-in required. Log in at /admin/ with a staff account, then try again.",
    bn: "স্টাফ লগইন প্রয়োজন। /admin/ এ স্টাফ অ্যাকাউন্ট দিয়ে লগইন করে আবার চেষ্টা করুন।",
  },

  // ---- how it works ---------------------------------------------------
  "hiw.title": { en: "How it works", bn: "কীভাবে কাজ করে" },
  "hiw.lede": {
    en: "No training needed. Here is the whole method, including what it cannot do.",
    bn: "কোনো প্রশিক্ষণ লাগবে না। পুরো পদ্ধতি এখানে — যা পারে না, তা সহ।",
  },
  "hiw.radar.title": { en: "Why radar, not a camera", bn: "ক্যামেরা নয়, রাডার কেন" },
  "hiw.radar.body": {
    en: "An ordinary satellite camera needs daylight and a clear sky. Bangladesh's flood season supplies neither: the monsoon can keep the country under cloud for weeks, which is exactly when a flood map matters most. Radar sends its own microwave pulse and measures what comes back, so it works at night and straight through cloud. Still water is smooth, so it reflects the pulse away from the satellite and returns almost nothing — on a radar image, flooding shows up as darkness.",
    bn: "সাধারণ স্যাটেলাইট ক্যামেরার জন্য দিনের আলো ও পরিষ্কার আকাশ দরকার। বন্যার মৌসুমে বাংলাদেশে তার কোনোটিই মেলে না: বর্ষায় দেশ সপ্তাহের পর সপ্তাহ মেঘে ঢাকা থাকে — ঠিক যখন বন্যার মানচিত্র সবচেয়ে বেশি দরকার। রাডার নিজেই মাইক্রোওয়েভ পাঠায় ও ফিরে আসা সংকেত মাপে, তাই রাতে এবং মেঘ ভেদ করেও কাজ করে। স্থির পানি মসৃণ, তাই সংকেত স্যাটেলাইট থেকে দূরে প্রতিফলিত হয় ও প্রায় কিছুই ফেরে না — রাডার ছবিতে বন্যা দেখা যায় অন্ধকার হিসেবে।",
  },
  "hiw.steps.title": { en: "The method in five steps", bn: "পাঁচ ধাপে পদ্ধতি" },
  "hiw.step1.title": { en: "Collect", bn: "সংগ্রহ" },
  "hiw.step1.body": {
    en: "Every 12 days NISAR passes over Bangladesh. We pull the L-band amplitude products for the country from ASF DAAC.",
    bn: "প্রতি ১২ দিনে নিসার বাংলাদেশের উপর দিয়ে যায়। আমরা এএসএফ ডিএএসি থেকে দেশের এল-ব্যান্ড অ্যামপ্লিচিউড প্রোডাক্ট নিই।",
  },
  "hiw.step2.title": { en: "Threshold", bn: "সীমা নির্ধারণ" },
  "hiw.step2.body": {
    en: "Pixels whose backscatter falls below a water threshold are marked as water. Smooth open water is dark; rough land is bright.",
    bn: "যেসব পিক্সেলের ব্যাকস্ক্যাটার পানির সীমার নিচে, সেগুলো পানি হিসেবে চিহ্নিত হয়। মসৃণ খোলা পানি অন্ধকার; অমসৃণ ভূমি উজ্জ্বল।",
  },
  "hiw.step3.title": { en: "Subtract normal water", bn: "স্বাভাবিক পানি বাদ" },
  "hiw.step3.body": {
    en: "Rivers, beels and ponds are water all year. We subtract a permanent-water layer so what remains is new water — flooding.",
    bn: "নদী, বিল ও পুকুরে সারা বছরই পানি থাকে। স্থায়ী জলাশয়ের স্তর বাদ দিলে যা থাকে তা নতুন পানি — অর্থাৎ বন্যা।",
  },
  "hiw.step4.title": { en: "Add up by district", bn: "জেলাভিত্তিক যোগ" },
  "hiw.step4.body": {
    en: "New-water pixels are summed inside each of the 64 district boundaries and converted to km², then to a share of the area the radar actually saw.",
    bn: "৬৪টি জেলার সীমানার ভেতরে নতুন পানির পিক্সেল যোগ করে বর্গকিমিতে, এরপর রাডার যতটুকু দেখেছে তার শতাংশে রূপান্তর করা হয়।",
  },
  "hiw.step5.title": { en: "Publish with its caveats", bn: "সতর্কতাসহ প্রকাশ" },
  "hiw.step5.body": {
    en: "Each district carries its coverage figure and its image date, so a low number from a half-seen district can never be mistaken for good news.",
    bn: "প্রতিটি জেলার সাথে তার কভারেজ ও ছবির তারিখ থাকে, যাতে অর্ধেক দেখা জেলার কম সংখ্যা কখনও সুসংবাদ বলে ভুল না হয়।",
  },
  "hiw.limits.title": { en: "What this cannot tell you", bn: "যা এটি বলতে পারে না" },
  "hiw.limit1": {
    en: "Water under a dense tree canopy or inside a built-up area is often invisible to the radar, so cities and forests read low.",
    bn: "ঘন গাছের নিচে বা ঘনবসতিপূর্ণ এলাকার ভেতরের পানি প্রায়ই রাডারে ধরা পড়ে না, তাই শহর ও বনাঞ্চলে সংখ্যা কম আসে।",
  },
  "hiw.limit2": {
    en: "Wet ground, fresh tarmac and smooth sand can all look like water. Expect false positives at the edges.",
    bn: "ভেজা মাটি, নতুন পিচঢালা রাস্তা ও মসৃণ বালু পানির মতো দেখাতে পারে। প্রান্তে ভুল শনাক্তকরণ আশা করুন।",
  },
  "hiw.limit3": {
    en: "A 12-day gap can miss a flash flood entirely: a haor can fill and drain between two passes.",
    bn: "১২ দিনের ব্যবধানে আকস্মিক বন্যা পুরোপুরি বাদ পড়তে পারে: দুই পাসের মাঝে একটি হাওর ভরে আবার নেমে যেতে পারে।",
  },
  "hiw.limit4": {
    en: "Percentages are of the observed area, not the whole district. Always read the coverage figure next to them.",
    bn: "শতাংশ পুরো জেলার নয়, পর্যবেক্ষিত এলাকার। পাশের কভারেজ সংখ্যাটি সবসময় দেখুন।",
  },
  "hiw.limit5": {
    en: "NISAR products are provisional during commissioning, and district boundaries are generalised, so areas carry a small error of their own.",
    bn: "কমিশনিং পর্বে নিসারের তথ্য অস্থায়ী, আর জেলার সীমানা সরলীকৃত — তাই আয়তনেও সামান্য ত্রুটি থাকে।",
  },
  "hiw.sources.title": { en: "Sources", bn: "সূত্র" },
  "hiw.reading.title": { en: "Reading the map", bn: "মানচিত্র পড়া" },

  // ---- about ----------------------------------------------------------
  "about.title": { en: "About", bn: "পরিচিতি" },
  "about.challenge.title": { en: "The challenge", bn: "চ্যালেঞ্জ" },
  "about.challenge.body": {
    en: "FloodCast Radar was built for the NASA Space Apps Challenge 2026 challenge \"Dancing with the SARs\", which asks teams to do something useful with synthetic aperture radar. Bangladesh is the obvious case: a country where the flood season and the cloud season are the same season.",
    bn: "ফ্লাডকাস্ট রাডার তৈরি হয়েছে নাসা স্পেস অ্যাপস চ্যালেঞ্জ ২০২৬-এর \"ড্যান্সিং উইথ দ্য সারস\" চ্যালেঞ্জের জন্য, যেখানে সিনথেটিক অ্যাপারচার রাডার দিয়ে কাজের কিছু করতে বলা হয়। বাংলাদেশ স্পষ্ট উদাহরণ: যেখানে বন্যার মৌসুম আর মেঘের মৌসুম একই।",
  },
  "about.goal.title": { en: "The goal", bn: "লক্ষ্য" },
  "about.goal.body": {
    en: "One page where anyone can see where the 2026 monsoon flooded, how much, and when — understandable in ten seconds, with no training and no account.",
    bn: "একটি পাতা, যেখানে যে কেউ দেখতে পাবে ২০২৬ সালের বর্ষায় কোথায়, কতটা ও কখন বন্যা হয়েছে — দশ সেকেন্ডে বোধগম্য, কোনো প্রশিক্ষণ বা অ্যাকাউন্ট ছাড়াই।",
  },
  "about.credits.title": { en: "Credits and licences", bn: "কৃতজ্ঞতা ও লাইসেন্স" },
  "about.data.title": { en: "Data honesty", bn: "তথ্যের স্বচ্ছতা" },
  "about.stack.title": { en: "How it is built", bn: "কীভাবে তৈরি" },
  "about.team.title": { en: "Team", bn: "দল" },

  // ---- risk drawer ------------------------------------------------------
  "risk.title": { en: "Flood risk outlook", bn: "বন্যা ঝুঁকির পূর্বাভাস" },
  "risk.chance": { en: "Chance of flooding", bn: "বন্যার সম্ভাবনা" },
  "risk.window": { en: "Next 12 days · until {date}", bn: "আগামী ১২ দিন · {date} পর্যন্ত" },
  "risk.asOf": { en: "As of radar pass {date}", bn: "{date} তারিখের রাডার পাস অনুযায়ী" },
  "risk.level.low": { en: "Low", bn: "কম" },
  "risk.level.moderate": { en: "Moderate", bn: "মাঝারি" },
  "risk.level.high": { en: "High", bn: "উচ্চ" },
  "risk.level.severe": { en: "Severe", bn: "চরম" },
  "risk.confidence": { en: "Confidence: {level}", bn: "নির্ভরযোগ্যতা: {level}" },
  "risk.confidence.low": { en: "low", bn: "কম" },
  "risk.confidence.medium": { en: "medium", bn: "মাঝারি" },
  "risk.confidence.high": { en: "high", bn: "উচ্চ" },
  "risk.now": { en: "Flooded now", bn: "এখন প্লাবিত" },
  "risk.trend": { en: "Trend", bn: "প্রবণতা" },
  "risk.trend.up": { en: "Rising", bn: "বাড়ছে" },
  "risk.trend.down": { en: "Falling", bn: "কমছে" },
  "risk.trend.flat": { en: "Steady", bn: "স্থির" },
  "risk.forecast": { en: "Expected next pass", bn: "পরবর্তী পাসে প্রত্যাশিত" },
  "risk.exposed": { en: "Land at risk", bn: "ঝুঁকিতে থাকা ভূমি" },
  "risk.peak": { en: "Season peak", bn: "মৌসুমের সর্বোচ্চ" },
  "risk.recurrence": { en: "Flood cycles", bn: "বন্যা চক্র" },
  "risk.recurrence.sub": { en: "{n} of {m} passes ≥ 10%", bn: "{m}টির মধ্যে {n}টি পাসে ≥ ১০%" },
  "risk.pp": { en: "pp", bn: "পয়েন্ট" },
  "risk.why": { en: "Why this score", bn: "এই স্কোর কেন" },
  "risk.why.hint": {
    en: "Each bar is the points that factor adds to the chance. All inputs are radar measurements or fixed facts about the district, and only passes up to the selected date are used.",
    bn: "প্রতিটি বার দেখায় ওই বিষয়টি সম্ভাবনায় কত পয়েন্ট যোগ করছে। সব তথ্য রাডার পরিমাপ বা জেলার স্থায়ী বৈশিষ্ট্য, এবং শুধু নির্বাচিত তারিখ পর্যন্ত পাস ব্যবহার করা হয়েছে।",
  },
  "risk.factor.current": { en: "Water on the ground now", bn: "এখন মাটিতে পানি" },
  "risk.factor.recent": { en: "Last three passes", bn: "শেষ তিনটি পাস" },
  "risk.factor.trend": { en: "Rising water", bn: "পানি বৃদ্ধি" },
  "risk.factor.frequency": { en: "Floods this season", bn: "এই মৌসুমে বন্যা" },
  "risk.factor.peak": { en: "Worst so far", bn: "এখন পর্যন্ত সর্বোচ্চ" },
  "risk.factor.terrain": { en: "River terrain", bn: "নদী ও ভূপ্রকৃতি" },
  "risk.factor.water": { en: "Rivers and wetlands", bn: "নদী ও জলাভূমি" },
  "risk.factor.season": { en: "Monsoon calendar", bn: "বর্ষার সময়" },
  "risk.history": { en: "This season, pass by pass", bn: "এই মৌসুম, প্রতিটি পাস" },
  "risk.actions": { en: "What to do now", bn: "এখন কী করবেন" },
  "risk.emergency": { en: "Emergency 999 · Disaster warning 1090", bn: "জরুরি ৯৯৯ · দুর্যোগ সতর্কবার্তা ১০৯০" },
  "risk.disclaimer": {
    en: "An experimental outlook from provisional NISAR radar. Always follow official FFWC/BWDB warnings.",
    bn: "অস্থায়ী নিসার রাডার তথ্যের পরীক্ষামূলক পূর্বাভাস। সর্বদা FFWC/পানি উন্নয়ন বোর্ডের সরকারি সতর্কবার্তা মেনে চলুন।",
  },
  "risk.notObserved": {
    en: "The radar has not seen this district yet this season, so the outlook rests on terrain and the monsoon calendar only.",
    bn: "এই মৌসুমে রাডার এখনও জেলাটি দেখেনি, তাই পূর্বাভাস শুধু ভূপ্রকৃতি ও বর্ষার সময়ের উপর ভিত্তি করে।",
  },
  "risk.error": { en: "Could not load the outlook.", bn: "পূর্বাভাস লোড করা যায়নি।" },

  "action.low.1": { en: "No action needed now. Keep following official FFWC forecasts.", bn: "এখন কিছু করার দরকার নেই। FFWC-এর সরকারি পূর্বাভাস অনুসরণ করুন।" },
  "action.low.2": { en: "Save emergency numbers: 999 and 1090.", bn: "জরুরি নম্বর সংরক্ষণ করুন: ৯৯৯ ও ১০৯০।" },
  "action.low.3": { en: "Know your nearest flood shelter and the route to it.", bn: "নিকটতম আশ্রয়কেন্দ্র ও সেখানে যাওয়ার পথ জেনে রাখুন।" },
  "action.moderate.1": { en: "Pack an emergency bag: water, dry food, medicine, torch, charger, papers in plastic.", bn: "জরুরি ব্যাগ গুছিয়ে রাখুন: পানি, শুকনো খাবার, ওষুধ, টর্চ, চার্জার, প্লাস্টিকে মোড়া কাগজপত্র।" },
  "action.moderate.2": { en: "Raise seed, fertiliser and valuables onto a platform.", bn: "বীজ, সার ও মূল্যবান জিনিস উঁচু মাচায় তুলুন।" },
  "action.moderate.3": { en: "Check on elderly neighbours, disabled people and pregnant women.", bn: "বয়স্ক প্রতিবেশী, প্রতিবন্ধী ও গর্ভবতী নারীদের খোঁজ নিন।" },
  "action.moderate.4": { en: "Follow river-level bulletins from BWDB/FFWC daily.", bn: "প্রতিদিন পানি উন্নয়ন বোর্ড/FFWC-এর নদীর পানির বুলেটিন দেখুন।" },
  "action.high.1": { en: "Be ready to move to a shelter at short notice, with livestock.", bn: "স্বল্প সময়ের নোটিশে গবাদিপশুসহ আশ্রয়কেন্দ্রে যাওয়ার জন্য প্রস্তুত থাকুন।" },
  "action.high.2": { en: "Store 3 days of drinking water and purification tablets.", bn: "৩ দিনের খাবার পানি ও বিশুদ্ধকরণ ট্যাবলেট রাখুন।" },
  "action.high.3": { en: "Raise tubewell heads and cover latrines.", bn: "টিউবওয়েলের মুখ উঁচু করুন ও ল্যাট্রিন ঢেকে রাখুন।" },
  "action.high.4": { en: "Switch off electricity at the mains if water enters the house.", bn: "ঘরে পানি ঢুকলে মেইন সুইচ বন্ধ করুন।" },
  "action.severe.1": { en: "Move to a shelter or higher ground now if authorities advise it.", bn: "কর্তৃপক্ষ বললে এখনই আশ্রয়কেন্দ্র বা উঁচু স্থানে যান।" },
  "action.severe.2": { en: "Never walk or drive through moving water.", bn: "কখনও স্রোতের পানির মধ্য দিয়ে হাঁটবেন বা গাড়ি চালাবেন না।" },
  "action.severe.3": { en: "Call 999 for rescue; 1090 for the latest warning.", bn: "উদ্ধারের জন্য ৯৯৯, সর্বশেষ সতর্কবার্তার জন্য ১০৯০-এ কল করুন।" },
  "action.severe.4": { en: "Drink only boiled or treated water; beware of snakes.", bn: "শুধু ফোটানো বা বিশুদ্ধ পানি পান করুন; সাপ থেকে সাবধান।" },

  "map.mode.label": { en: "Map shows", bn: "মানচিত্রে দেখাচ্ছে" },
  "map.mode.flood": { en: "Flooded now", bn: "এখন প্লাবিত" },
  "map.mode.risk": { en: "12-day risk", bn: "১২ দিনের ঝুঁকি" },
  "risk.legend.title": { en: "Chance of flooding, next 12 days", bn: "আগামী ১২ দিনে বন্যার সম্ভাবনা" },
  "risk.legend.note": {
    en: "Click any district for the full outlook, the reasons and what to do.",
    bn: "পূর্ণ পূর্বাভাস, কারণ ও করণীয় জানতে যেকোনো জেলায় ক্লিক করুন।",
  },
  "risk.ranking.title": { en: "Highest flood risk", bn: "সর্বোচ্চ বন্যা ঝুঁকি" },
  "risk.ranking.sub": { en: "Next 12 days", bn: "আগামী ১২ দিন" },
  "risk.summary.title": { en: "Flood risk across Bangladesh", bn: "সারা বাংলাদেশে বন্যা ঝুঁকি" },
  "risk.summary.top": { en: "Highest risk now", bn: "এখন সর্বোচ্চ ঝুঁকি" },
  // ---- e-mail alerts --------------------------------------------------------
  "sub.cta": { en: "Get flood alerts", bn: "বন্যা সতর্কবার্তা পান" },
  "sub.title": { en: "Get automatic flood alerts by e-mail", bn: "ই-মেইলে স্বয়ংক্রিয় বন্যা সতর্কবার্তা পান" },
  "sub.body": {
    en: "We check every new NISAR radar pass and e-mail you as soon as the outlook for your district reaches your chosen level, with the steps to take.",
    bn: "প্রতিটি নতুন নিসার রাডার পাস আমরা যাচাই করি এবং আপনার জেলার পূর্বাভাস নির্বাচিত মাত্রায় পৌঁছালেই করণীয়সহ ই-মেইল পাঠাই।",
  },
  "sub.name": { en: "Your name", bn: "আপনার নাম" },
  "sub.email": { en: "E-mail address", bn: "ই-মেইল ঠিকানা" },
  "sub.district": { en: "District", bn: "জেলা" },
  "sub.district.pick": { en: "Choose a district", bn: "জেলা বেছে নিন" },
  "sub.level": { en: "Alert me at", bn: "সতর্ক করুন যখন" },
  "sub.level.moderate": { en: "Moderate or higher", bn: "মাঝারি বা তার বেশি" },
  "sub.level.high": { en: "High or higher", bn: "উচ্চ বা তার বেশি" },
  "sub.level.severe": { en: "Severe only", bn: "শুধু চরম" },
  "sub.submit": { en: "Subscribe to alerts", bn: "সতর্কবার্তার জন্য সাবস্ক্রাইব করুন" },
  "sub.sending": { en: "Subscribing…", bn: "সাবস্ক্রাইব হচ্ছে…" },
  "sub.done": { en: "You're subscribed", bn: "আপনি সাবস্ক্রাইব করেছেন" },
  "sub.done.body": {
    en: "A confirmation with today's outlook for {name} is on its way to {email}. Every e-mail has a one-click unsubscribe link.",
    bn: "{name}-এর আজকের পূর্বাভাসসহ নিশ্চিতকরণ ই-মেইল {email}-এ পাঠানো হয়েছে। প্রতিটি ই-মেইলে এক ক্লিকে আনসাবস্ক্রাইবের লিংক থাকে।",
  },
  "sub.another": { en: "Add another district", bn: "আরেকটি জেলা যোগ করুন" },
  "sub.privacy": {
    en: "Used only for flood alerts. No spam, unsubscribe any time.",
    bn: "শুধু বন্যা সতর্কবার্তার জন্য ব্যবহৃত। কোনো স্প্যাম নেই, যেকোনো সময় আনসাবস্ক্রাইব করুন।",
  },
  "sub.invalid.name": { en: "Please enter your name.", bn: "আপনার নাম লিখুন।" },
  "sub.invalid.email": { en: "Please enter a valid e-mail address.", bn: "সঠিক ই-মেইল ঠিকানা লিখুন।" },
  "sub.invalid.district": { en: "Please choose a district.", bn: "একটি জেলা বেছে নিন।" },

  // ---- shared ---------------------------------------------------------
  "common.loading": { en: "Loading…", bn: "লোড হচ্ছে…" },
  "common.error": { en: "Something went wrong", bn: "কিছু একটা ভুল হয়েছে" },
  "common.retry": { en: "Try again", bn: "আবার চেষ্টা করুন" },
  "common.km2": { en: "km²", bn: "বর্গকিমি" },
  "common.of": { en: "of", bn: "/" },
  "common.notObserved": { en: "Not observed", bn: "পর্যবেক্ষণ হয়নি" },
  "common.partlyObserved": { en: "Partly observed", bn: "আংশিক পর্যবেক্ষিত" },
  "common.close": { en: "Close", bn: "বন্ধ" },
  "common.source": { en: "Source", bn: "সূত্র" },
  "common.cycle": { en: "Cycle", bn: "চক্র" },
  "common.district": { en: "District", bn: "জেলা" },
  "common.districts": { en: "districts", bn: "জেলা" },
  "common.skipToContent": { en: "Skip to content", bn: "সরাসরি বিষয়বস্তুতে" },

  // ---- BMD field portal -------------------------------------------------
  "nav.bmd": { en: "BMD Portal", bn: "বিএমডি পোর্টাল" },
  "bmd.org": { en: "Bangladesh Meteorological Department", bn: "বাংলাদেশ আবহাওয়া অধিদপ্তর" },
  "bmd.title": { en: "Field Situation Dashboard", bn: "মাঠ পরিস্থিতি ড্যাশবোর্ড" },
  "bmd.lede": {
    en: "Ground reports from BMD officers in every district: what they are seeing right now, and the steps they have taken. Read alongside the NISAR radar flood map.",
    bn: "প্রতিটি জেলার বিএমডি কর্মকর্তাদের মাঠ প্রতিবেদন: এই মুহূর্তে তারা কী দেখছেন এবং কী পদক্ষেপ নিয়েছেন। নিসার রাডার বন্যা মানচিত্রের পাশাপাশি পড়ুন।",
  },
  "bmd.submit": { en: "File a field report", bn: "মাঠ প্রতিবেদন দিন" },
  "bmd.signin": { en: "Officer sign in", bn: "কর্মকর্তা লগইন" },
  "bmd.register": { en: "Register as officer", bn: "কর্মকর্তা নিবন্ধন" },
  "bmd.signout": { en: "Sign out", bn: "লগআউট" },
  "bmd.signedInAs": { en: "Signed in as", bn: "লগইন করেছেন" },
  "bmd.pending": { en: "Pending verification", bn: "যাচাই অপেক্ষমাণ" },
  "bmd.pending.hint": {
    en: "Your reports are published, marked “Unverified” until a FloodCast Radar administrator confirms your BMD credentials.",
    bn: "আপনার প্রতিবেদন প্রকাশিত হবে, তবে প্রশাসক আপনার বিএমডি পরিচয় নিশ্চিত না করা পর্যন্ত “অযাচাইকৃত” চিহ্নিত থাকবে।",
  },
  "bmd.verified": { en: "Verified officer", bn: "যাচাইকৃত কর্মকর্তা" },
  "bmd.unverified": { en: "Unverified", bn: "অযাচাইকৃত" },
  "bmd.kpi.reports24": { en: "Reports, last 24 h", bn: "গত ২৪ ঘণ্টার প্রতিবেদন" },
  "bmd.kpi.districts": { en: "Districts reporting (7 days)", bn: "প্রতিবেদনকারী জেলা (৭ দিন)" },
  "bmd.kpi.danger": { en: "At danger level or worse", bn: "বিপদসীমা বা তার বেশি" },
  "bmd.kpi.affected": { en: "People affected (latest)", bn: "ক্ষতিগ্রস্ত মানুষ (সর্বশেষ)" },
  "bmd.kpi.officers": { en: "{verified} of {total} officers verified", bn: "{total} জনের মধ্যে {verified} জন যাচাইকৃত" },
  "bmd.kpi.shelters": { en: "{n} shelters open", bn: "{n}টি আশ্রয়কেন্দ্র খোলা" },
  "bmd.board.title": { en: "District status board", bn: "জেলা পরিস্থিতি বোর্ড" },
  "bmd.board.sub": { en: "Latest report from each district in the last 7 days, most severe first", bn: "গত ৭ দিনে প্রতিটি জেলার সর্বশেষ প্রতিবেদন, সবচেয়ে গুরুতর আগে" },
  "bmd.board.empty": { en: "No district has reported in the last 7 days.", bn: "গত ৭ দিনে কোনো জেলা প্রতিবেদন দেয়নি।" },
  "bmd.feed.title": { en: "Field reports", bn: "মাঠ প্রতিবেদন" },
  "bmd.feed.empty": { en: "No reports match these filters yet.", bn: "এই ফিল্টারে এখনো কোনো প্রতিবেদন নেই।" },
  "bmd.feed.more": { en: "Show more", bn: "আরও দেখুন" },
  "bmd.feed.count": { en: "{shown} of {total} reports", bn: "{total}টির মধ্যে {shown}টি প্রতিবেদন" },
  "bmd.filter.all": { en: "All", bn: "সব" },
  "bmd.filter.allDistricts": { en: "All districts", bn: "সব জেলা" },
  "bmd.filter.allDivisions": { en: "All divisions", bn: "সব বিভাগ" },
  "bmd.filter.anyTime": { en: "Any time", bn: "যেকোনো সময়" },
  "bmd.filter.24h": { en: "Last 24 hours", bn: "গত ২৪ ঘণ্টা" },
  "bmd.filter.72h": { en: "Last 3 days", bn: "গত ৩ দিন" },
  "bmd.filter.7d": { en: "Last 7 days", bn: "গত ৭ দিন" },
  "bmd.filter.verifiedOnly": { en: "Verified officers only", bn: "শুধু যাচাইকৃত কর্মকর্তা" },
  "bmd.filter.mine": { en: "My reports", bn: "আমার প্রতিবেদন" },
  "bmd.level": { en: "Situation level", bn: "পরিস্থিতির মাত্রা" },
  "bmd.level.normal": { en: "Normal", bn: "স্বাভাবিক" },
  "bmd.level.alert": { en: "Alert", bn: "সতর্ক" },
  "bmd.level.warning": { en: "Warning", bn: "সতর্কবার্তা" },
  "bmd.level.danger": { en: "Danger", bn: "বিপদ" },
  "bmd.level.extreme": { en: "Extreme danger", bn: "মহাবিপদ" },
  "bmd.trend": { en: "Water level trend", bn: "পানির স্তরের প্রবণতা" },
  "bmd.trend.rising": { en: "Rising", bn: "বাড়ছে" },
  "bmd.trend.steady": { en: "Steady", bn: "স্থিতিশীল" },
  "bmd.trend.falling": { en: "Falling", bn: "কমছে" },
  "bmd.trend.unknown": { en: "Not measured", bn: "পরিমাপ হয়নি" },
  "bmd.f.conditions": { en: "Current conditions", bn: "বর্তমান পরিস্থিতি" },
  "bmd.f.conditions.hint": { en: "What you are seeing in the district right now: inundated areas, river status, roads, embankments.", bn: "এই মুহূর্তে জেলায় যা দেখছেন: প্লাবিত এলাকা, নদীর অবস্থা, সড়ক, বাঁধ।" },
  "bmd.f.actions": { en: "Steps taken", bn: "গৃহীত পদক্ষেপ" },
  "bmd.f.actions.hint": { en: "Warnings issued, agencies coordinated, evacuations supported, bulletins sent.", bn: "জারি করা সতর্কবার্তা, সমন্বিত সংস্থা, সহায়তাকৃত সরিয়ে নেওয়া, পাঠানো বুলেটিন।" },
  "bmd.f.needs": { en: "Support needed (optional)", bn: "প্রয়োজনীয় সহায়তা (ঐচ্ছিক)" },
  "bmd.f.rainfall": { en: "Rainfall, last 24 h (mm)", bn: "গত ২৪ ঘণ্টার বৃষ্টিপাত (মিমি)" },
  "bmd.f.station": { en: "River gauge station", bn: "নদীর গেজ স্টেশন" },
  "bmd.f.waterLevel": { en: "Water level (m)", bn: "পানির স্তর (মি)" },
  "bmd.f.dangerLevel": { en: "Danger level (m)", bn: "বিপদসীমা (মি)" },
  "bmd.f.affected": { en: "People affected", bn: "ক্ষতিগ্রস্ত মানুষ" },
  "bmd.f.shelters": { en: "Shelters open", bn: "খোলা আশ্রয়কেন্দ্র" },
  "bmd.f.observedAt": { en: "Observed at", bn: "পর্যবেক্ষণের সময়" },
  "bmd.f.measurements": { en: "Measurements", bn: "পরিমাপ" },
  "bmd.f.impact": { en: "Impact", bn: "প্রভাব" },
  "bmd.f.situation": { en: "Situation", bn: "পরিস্থিতি" },
  "bmd.f.narrative": { en: "Field narrative", bn: "মাঠের বিবরণ" },
  "bmd.f.reportingFor": { en: "Reporting for {district} district", bn: "{district} জেলার জন্য প্রতিবেদন" },
  "bmd.f.send": { en: "Publish report", bn: "প্রতিবেদন প্রকাশ করুন" },
  "bmd.f.update": { en: "Save changes", bn: "পরিবর্তন সংরক্ষণ" },
  "bmd.f.sending": { en: "Publishing…", bn: "প্রকাশ হচ্ছে…" },
  "bmd.f.done": { en: "Report published", bn: "প্রতিবেদন প্রকাশিত" },
  "bmd.f.aboveDanger": { en: "{cm} cm above danger level", bn: "বিপদসীমার {cm} সেমি উপরে" },
  "bmd.f.belowDanger": { en: "{cm} cm below danger level", bn: "বিপদসীমার {cm} সেমি নিচে" },
  "bmd.r.edit": { en: "Edit", bn: "সম্পাদনা" },
  "bmd.r.delete": { en: "Withdraw", bn: "প্রত্যাহার" },
  "bmd.r.confirmDelete": { en: "Withdraw this report? Tap again to confirm.", bn: "প্রতিবেদন প্রত্যাহার করবেন? নিশ্চিত করতে আবার চাপুন।" },
  "bmd.r.needs": { en: "Support needed", bn: "প্রয়োজনীয় সহায়তা" },
  "bmd.r.yours": { en: "Your report", bn: "আপনার প্রতিবেদন" },
  "bmd.a.email": { en: "Official e-mail", bn: "দাপ্তরিক ই-মেইল" },
  "bmd.a.password": { en: "Password", bn: "পাসওয়ার্ড" },
  "bmd.a.password.hint": { en: "At least 8 characters, not only numbers.", bn: "কমপক্ষে ৮ অক্ষর, শুধু সংখ্যা নয়।" },
  "bmd.a.confirm": { en: "Confirm password", bn: "পাসওয়ার্ড নিশ্চিত করুন" },
  "bmd.a.mismatch": { en: "Passwords do not match.", bn: "পাসওয়ার্ড মেলেনি।" },
  "bmd.a.fullName": { en: "Full name", bn: "পূর্ণ নাম" },
  "bmd.a.designation": { en: "Designation", bn: "পদবি" },
  "bmd.a.employeeId": { en: "BMD employee ID", bn: "বিএমডি কর্মচারী আইডি" },
  "bmd.a.phone": { en: "Mobile number", bn: "মোবাইল নম্বর" },
  "bmd.a.office": { en: "Office / station", bn: "অফিস / স্টেশন" },
  "bmd.a.district": { en: "District of posting", bn: "কর্মস্থলের জেলা" },
  "bmd.a.signinTitle": { en: "Sign in to the BMD field portal", bn: "বিএমডি মাঠ পোর্টালে লগইন করুন" },
  "bmd.a.signinSub": { en: "For Bangladesh Meteorological Department officers filing district situation reports.", bn: "জেলা পরিস্থিতি প্রতিবেদন দাখিলকারী বাংলাদেশ আবহাওয়া অধিদপ্তরের কর্মকর্তাদের জন্য।" },
  "bmd.a.registerTitle": { en: "Register as a BMD officer", bn: "বিএমডি কর্মকর্তা হিসেবে নিবন্ধন" },
  "bmd.a.registerSub": { en: "One account per officer. You will report for the district you are posted to. An administrator verifies every account.", bn: "প্রতি কর্মকর্তার একটি অ্যাকাউন্ট। আপনি আপনার কর্মস্থলের জেলার জন্য প্রতিবেদন দেবেন। প্রশাসক প্রতিটি অ্যাকাউন্ট যাচাই করেন।" },
  "bmd.a.noAccount": { en: "No account yet?", bn: "এখনো অ্যাকাউন্ট নেই?" },
  "bmd.a.haveAccount": { en: "Already registered?", bn: "আগেই নিবন্ধিত?" },
  "bmd.a.working": { en: "Please wait…", bn: "অপেক্ষা করুন…" },
  "bmd.a.required": { en: "Required", bn: "আবশ্যক" },
  "bmd.a.needLogin": { en: "Sign in with your officer account to file a report.", bn: "প্রতিবেদন দিতে কর্মকর্তা অ্যাকাউন্টে লগইন করুন।" },
  "bmd.a.identity": { en: "Officer identity", bn: "কর্মকর্তার পরিচয়" },
  "bmd.a.posting": { en: "Posting", bn: "কর্মস্থল" },
  "bmd.a.account": { en: "Account", bn: "অ্যাকাউন্ট" },
  "bmd.district.title": { en: "BMD field reports", bn: "বিএমডি মাঠ প্রতিবেদন" },
  "bmd.district.empty": { en: "No BMD officer has reported from {district} yet.", bn: "{district} থেকে এখনো কোনো বিএমডি কর্মকর্তা প্রতিবেদন দেননি।" },
  "bmd.district.all": { en: "All field reports", bn: "সব মাঠ প্রতিবেদন" },
  "bmd.ago.now": { en: "just now", bn: "এইমাত্র" },
  "bmd.ago.min": { en: "{n} min ago", bn: "{n} মিনিট আগে" },
  "bmd.ago.hour": { en: "{n} h ago", bn: "{n} ঘণ্টা আগে" },
  "bmd.ago.day": { en: "{n} d ago", bn: "{n} দিন আগে" },
  "bmd.refresh": { en: "Refresh", bn: "হালনাগাদ" },
  "bmd.loadError": { en: "Could not load field reports. Check that the backend is running.", bn: "মাঠ প্রতিবেদন লোড করা যায়নি। ব্যাকএন্ড চলছে কিনা দেখুন।" },

  // ---- errors -------------------------------------------------------------
  "err.title": { en: "Something went wrong", bn: "কিছু একটা ভুল হয়েছে" },
  "err.body": {
    en: "This page could not load its data. The FloodCast Radar backend may be offline or still starting up.",
    bn: "এই পাতার তথ্য লোড করা যায়নি। ফ্লাডকাস্ট রাডার ব্যাকএন্ড হয়তো বন্ধ বা চালু হচ্ছে।",
  },
  "err.retry": { en: "Try again", bn: "আবার চেষ্টা করুন" },
  "err.home": { en: "Back to home", bn: "হোমে ফিরুন" },
  "err.404.title": { en: "Page not found", bn: "পাতা পাওয়া যায়নি" },
  "err.404.body": { en: "The page or district you asked for does not exist. Try searching for a district instead.", bn: "আপনি যে পাতা বা জেলা চেয়েছেন তা নেই। বরং একটি জেলা খুঁজে দেখুন।" },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

/**
 * Look up a string and fill `{placeholders}`.
 * Falls back to English, then to the key itself, so a missing translation
 * degrades to something readable instead of blank space.
 */
export function translate(
  key: StringKey,
  lang: Lang,
  vars?: Record<string, string | number>,
): string {
  const entry = STRINGS[key] as Entry | undefined;
  let text = entry?.[lang] ?? entry?.en ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Human label for a district's flood setting, used on the district page. */
export const REGIME_LABEL: Record<string, Entry> = {
  brahmaputra: { en: "Brahmaputra floodplain", bn: "ব্রহ্মপুত্র প্লাবনভূমি" },
  "jamuna-char": { en: "Jamuna char land", bn: "যমুনার চর" },
  padma: { en: "Padma floodplain", bn: "পদ্মা প্লাবনভূমি" },
  "meghna-haor": { en: "Meghna and haor basin", bn: "মেঘনা ও হাওর অববাহিকা" },
  delta: { en: "Lower delta", bn: "নিম্ন ব-দ্বীপ" },
  coastal: { en: "Coastal and tidal", bn: "উপকূল ও জোয়ারভাটা" },
  urban: { en: "Urban floodplain", bn: "নগর প্লাবনভূমি" },
  barind: { en: "Barind high ground", bn: "বরেন্দ্র উঁচু ভূমি" },
  hill: { en: "Hill tracts", bn: "পার্বত্য এলাকা" },
};

export function regimeLabel(regime: string, lang: Lang): string {
  return REGIME_LABEL[regime]?.[lang] ?? regime;
}

export const DIVISION_BN: Record<string, string> = {
  Barishal: "বরিশাল",
  Chattogram: "চট্টগ্রাম",
  Dhaka: "ঢাকা",
  Khulna: "খুলনা",
  Mymensingh: "ময়মনসিংহ",
  Rajshahi: "রাজশাহী",
  Rangpur: "রংপুর",
  Sylhet: "সিলেট",
};

export function divisionName(division: string, lang: Lang): string {
  return lang === "bn" ? DIVISION_BN[division] ?? division : division;
}
