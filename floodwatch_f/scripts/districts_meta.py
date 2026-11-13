"""Static per-district metadata that is not present in the geoBoundaries file.

`SOURCE_NAME -> (official English name, Bangla name, division, flood regime)`

* SOURCE_NAME is `properties.shapeName` in geoBoundaries-BGD-ADM2 (2020 release),
  which still uses several pre-2018 romanisations (Bogra, Jessore, Comilla, ...).
* The official English name is the current Bangladesh spelling and is what the UI
  shows; `source_name` is carried through to the output so a row can always be
  matched back to the boundary file or to the backend.
* `regime` selects the demo flood model in seed_data.py. One of:
  brahmaputra | jamuna-char | padma | meghna-haor | coastal | delta |
  hill | barind | urban
"""

DISTRICTS = {
    # source_name          official EN          Bangla                division     regime
    "Bagerhat":        ("Bagerhat", "বাগেরহাট", "Khulna", "coastal"),
    "Bandarban":       ("Bandarban", "বান্দরবান", "Chattogram", "hill"),
    "Barguna":         ("Barguna", "বরগুনা", "Barishal", "coastal"),
    "Barisal":         ("Barishal", "বরিশাল", "Barishal", "delta"),
    "Bhola":           ("Bhola", "ভোলা", "Barishal", "delta"),
    "Bogra":           ("Bogura", "বগুড়া", "Rajshahi", "jamuna-char"),
    "Brahamanbaria":   ("Brahmanbaria", "ব্রাহ্মণবাড়িয়া", "Chattogram", "meghna-haor"),
    "Chandpur":        ("Chandpur", "চাঁদপুর", "Chattogram", "padma"),
    "Chittagong":      ("Chattogram", "চট্টগ্রাম", "Chattogram", "hill"),
    "Chuadanga":       ("Chuadanga", "চুয়াডাঙ্গা", "Khulna", "barind"),
    "Comilla":         ("Cumilla", "কুমিল্লা", "Chattogram", "meghna-haor"),
    "Cox's Bazar":     ("Cox's Bazar", "কক্সবাজার", "Chattogram", "coastal"),
    "Dhaka":           ("Dhaka", "ঢাকা", "Dhaka", "urban"),
    "Dinajpur":        ("Dinajpur", "দিনাজপুর", "Rangpur", "barind"),
    "Faridpur":        ("Faridpur", "ফরিদপুর", "Dhaka", "padma"),
    "Feni":            ("Feni", "ফেনী", "Chattogram", "coastal"),
    "Gaibandha":       ("Gaibandha", "গাইবান্ধা", "Rangpur", "jamuna-char"),
    "Gazipur":         ("Gazipur", "গাজীপুর", "Dhaka", "urban"),
    "Gopalganj":       ("Gopalganj", "গোপালগঞ্জ", "Dhaka", "delta"),
    "Habiganj":        ("Habiganj", "হবিগঞ্জ", "Sylhet", "meghna-haor"),
    "Jamalpur":        ("Jamalpur", "জামালপুর", "Mymensingh", "brahmaputra"),
    "Jessore":         ("Jashore", "যশোর", "Khulna", "barind"),
    "Jhalokati":       ("Jhalokathi", "ঝালকাঠি", "Barishal", "delta"),
    "Jhenaidah":       ("Jhenaidah", "ঝিনাইদহ", "Khulna", "barind"),
    "Joypurhat":       ("Joypurhat", "জয়পুরহাট", "Rajshahi", "barind"),
    "Khagrachhari":    ("Khagrachhari", "খাগড়াছড়ি", "Chattogram", "hill"),
    "Khulna":          ("Khulna", "খুলনা", "Khulna", "coastal"),
    "Kishoreganj":     ("Kishoreganj", "কিশোরগঞ্জ", "Dhaka", "meghna-haor"),
    "Kurigram":        ("Kurigram", "কুড়িগ্রাম", "Rangpur", "brahmaputra"),
    "Kushtia":         ("Kushtia", "কুষ্টিয়া", "Khulna", "padma"),
    "Lakshmipur":      ("Lakshmipur", "লক্ষ্মীপুর", "Chattogram", "delta"),
    "Lalmonirhat":     ("Lalmonirhat", "লালমনিরহাট", "Rangpur", "brahmaputra"),
    "Madaripur":       ("Madaripur", "মাদারিপুর", "Dhaka", "padma"),
    "Magura":          ("Magura", "মাগুরা", "Khulna", "barind"),
    "Manikganj":       ("Manikganj", "মানিকগঞ্জ", "Dhaka", "jamuna-char"),
    "Maulvibazar":     ("Moulvibazar", "মৌলভীবাজার", "Sylhet", "meghna-haor"),
    "Meherpur":        ("Meherpur", "মেহেরপুর", "Khulna", "barind"),
    "Munshiganj":      ("Munshiganj", "মুন্সীগঞ্জ", "Dhaka", "padma"),
    "Mymensingh":      ("Mymensingh", "ময়মনসিংহ", "Mymensingh", "brahmaputra"),
    "Naogaon":         ("Naogaon", "নওগাঁ", "Rajshahi", "barind"),
    "Narail":          ("Narail", "নড়াইল", "Khulna", "delta"),
    "Narayanganj":     ("Narayanganj", "নারায়ণগঞ্জ", "Dhaka", "urban"),
    "Narsingdi":       ("Narsingdi", "নরসিংদী", "Dhaka", "meghna-haor"),
    "Natore":          ("Natore", "নাটোর", "Rajshahi", "jamuna-char"),
    "Nawabganj":       ("Chapai Nawabganj", "চাঁপাইনবাবগঞ্জ", "Rajshahi", "padma"),
    "Netrakona":       ("Netrokona", "নেত্রকোণা", "Mymensingh", "meghna-haor"),
    "Nilphamari":      ("Nilphamari", "নীলফামারী", "Rangpur", "brahmaputra"),
    "Noakhali":        ("Noakhali", "নোয়াখালী", "Chattogram", "delta"),
    "Pabna":           ("Pabna", "পাবনা", "Rajshahi", "jamuna-char"),
    "Panchagarh":      ("Panchagarh", "পঞ্চগড়", "Rangpur", "barind"),
    "Patuakhali":      ("Patuakhali", "পটুয়াখালী", "Barishal", "coastal"),
    "Pirojpur":        ("Pirojpur", "পিরোজপুর", "Barishal", "delta"),
    "Rajbari":         ("Rajbari", "রাজবাড়ী", "Dhaka", "padma"),
    "Rajshahi":        ("Rajshahi", "রাজশাহী", "Rajshahi", "padma"),
    "Rangamati":       ("Rangamati", "রাঙ্গামাটি", "Chattogram", "hill"),
    "Rangpur":         ("Rangpur", "রংপুর", "Rangpur", "brahmaputra"),
    "Satkhira":        ("Satkhira", "সাতক্ষীরা", "Khulna", "coastal"),
    "Shariatpur":      ("Shariatpur", "শরীয়তপুর", "Dhaka", "padma"),
    "Sherpur":         ("Sherpur", "শেরপুর", "Mymensingh", "brahmaputra"),
    "Sirajganj":       ("Sirajganj", "সিরাজগঞ্জ", "Rajshahi", "jamuna-char"),
    "Sunamganj":       ("Sunamganj", "সুনামগঞ্জ", "Sylhet", "meghna-haor"),
    "Sylhet":          ("Sylhet", "সিলেট", "Sylhet", "meghna-haor"),
    "Tangail":         ("Tangail", "টাঙ্গাইল", "Dhaka", "jamuna-char"),
    "Thakurgaon":      ("Thakurgaon", "ঠাকুরগাঁও", "Rangpur", "barind"),
}

# Per-regime demo flood behaviour.
#
#   peak        fraction of the district that can be under new water at its own peak
#   river_pull  how tightly flooding hugs the permanent-water network (0..1)
#   lag         days the local response lags (+) or leads (-) the shared event date
#   events      how strongly the regime responds to each of the four flood episodes
#               in the 2026 season (see SEASON_EVENTS in seed_data.py):
#                 flash    late-June pre-monsoon flash flood, hits the haors first
#                 main     the main Brahmaputra/Ganges monsoon peak in late July
#                 late     the early-September second crest
#                 cyclone  a mid-October cyclone surge, a coastal/delta event
#
# Mixing four episodes with different regional weights is what stops one district
# from being "worst" all season and gives the timeline a shape worth animating.
REGIME = {
    "brahmaputra": {"peak": 0.30, "river_pull": 0.86, "lag": -2,
                    "events": {"flash": 0.50, "main": 1.00, "late": 0.80, "cyclone": 0.05}},
    "jamuna-char": {"peak": 0.34, "river_pull": 0.88, "lag": 0,
                    "events": {"flash": 0.40, "main": 1.00, "late": 0.85, "cyclone": 0.05}},
    "padma":       {"peak": 0.23, "river_pull": 0.82, "lag": 4,
                    "events": {"flash": 0.25, "main": 0.90, "late": 1.00, "cyclone": 0.35}},
    "meghna-haor": {"peak": 0.27, "river_pull": 0.58, "lag": -6,
                    "events": {"flash": 1.00, "main": 0.85, "late": 0.50, "cyclone": 0.15}},
    "delta":       {"peak": 0.20, "river_pull": 0.70, "lag": 8,
                    "events": {"flash": 0.20, "main": 0.60, "late": 0.80, "cyclone": 1.00}},
    "coastal":     {"peak": 0.16, "river_pull": 0.62, "lag": 10,
                    "events": {"flash": 0.15, "main": 0.45, "late": 0.60, "cyclone": 1.00}},
    "urban":       {"peak": 0.09, "river_pull": 0.74, "lag": 2,
                    "events": {"flash": 0.40, "main": 1.00, "late": 0.60, "cyclone": 0.30}},
    "barind":      {"peak": 0.05, "river_pull": 0.78, "lag": 2,
                    "events": {"flash": 0.30, "main": 1.00, "late": 0.50, "cyclone": 0.10}},
    "hill":        {"peak": 0.04, "river_pull": 0.90, "lag": -4,
                    "events": {"flash": 1.00, "main": 0.80, "late": 0.60, "cyclone": 0.50}},
}

assert len(DISTRICTS) == 64, len(DISTRICTS)
assert set(r[3] for r in DISTRICTS.values()) <= set(REGIME)
