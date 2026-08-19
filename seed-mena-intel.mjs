/**
 * MENA Country Intelligence Seed Script
 * Sources: CIA World Factbook 2024, SIPRI 2024, RSF 2024, Freedom House 2024,
 *          TI CPI 2024, World Bank 2024, ACLED 2024, IAEA, UN OCHA, US State Dept
 *
 * Schema columns: id, country, isoA3, region, capital, governmentType, headOfState,
 *   population, gdpUsd, gdpPerCapita, militaryBudgetUsd, armedForcesSize,
 *   threatLevel (LOW/MODERATE/HIGH/CRITICAL/EXTREME),
 *   nuclearStatus (none/civilian/suspected/confirmed/treaty),
 *   sanctionsStatus, unMemberStatus, keyLeaders (json), alliances (json),
 *   activeConflicts (json), humanRightsIndex (float), pressFreedomIndex (int),
 *   corruptionIndex (int), internetFreedom (free/partly_free/not_free),
 *   keyIntelNotes, sources (json), lastUpdated, createdAt, updatedAt
 *
 * Run: node seed-mena-intel.mjs
 */

import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const MENA_COUNTRIES = [
  {
    country: "Egypt",
    isoA3: "EGY",
    region: "North Africa",
    capital: "Cairo",
    governmentType: "Presidential republic (authoritarian)",
    headOfState: "President Abdel Fattah el-Sisi (since 2014)",
    population: 106000000,
    gdpUsd: 396000000000,
    gdpPerCapita: 3700,
    militaryBudgetUsd: 4800000000,
    armedForcesSize: 438500,
    threatLevel: "HIGH",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions. US provides ~$1.3B annual military aid.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Abdel Fattah el-Sisi", role: "President", since: "2014" },
      { name: "Mostafa Madbouly", role: "Prime Minister", since: "2018" },
      { name: "General Osama Askar", role: "Chief of Staff", since: "2017" }
    ],
    alliances: ["United States (military aid)", "Saudi Arabia", "UAE", "Arab League", "African Union"],
    activeConflicts: [
      { name: "Sinai Insurgency", since: "2011", type: "Counterterrorism", status: "Active — ISIS-Sinai Province (Wilayat Sinai)" },
      { name: "GERD Water Dispute", since: "2011", type: "Diplomatic/Strategic", status: "Ongoing — Ethiopia Grand Renaissance Dam threatens Nile water share" }
    ],
    humanRightsIndex: 1.4,
    pressFreedomIndex: 170,
    corruptionIndex: 35,
    internetFreedom: "not_free",
    keyIntelNotes: "Egypt is a key US partner receiving ~$1.3B annual military aid. Suez Canal is a critical global chokepoint handling ~12% of world trade. Active ISIS insurgency in North Sinai. GERD dispute with Ethiopia over Nile water rights is a major strategic concern. Political repression intensified post-2013 coup. Freedom House: Not Free (14/100). RSF 2024: ranked 170/180.",
    sources: [
      { name: "CIA World Factbook — Egypt", url: "https://www.cia.gov/the-world-factbook/countries/egypt/", date: "2024" },
      { name: "Freedom House 2024 — Egypt", url: "https://freedomhouse.org/country/egypt/freedom-world/2024", date: "2024" },
      { name: "RSF Press Freedom Index 2024", url: "https://rsf.org/en/country/egypt", date: "2024" },
      { name: "SIPRI Military Expenditure 2024", url: "https://www.sipri.org/databases/milex", date: "2024" },
      { name: "TI CPI 2024 — Egypt", url: "https://www.transparency.org/en/countries/egypt", date: "2024" },
      { name: "ACLED — Egypt conflict data", url: "https://acleddata.com/data-export-tool/", date: "2024" }
    ]
  },
  {
    country: "Saudi Arabia",
    isoA3: "SAU",
    region: "Gulf",
    capital: "Riyadh",
    governmentType: "Absolute monarchy",
    headOfState: "King Salman bin Abdulaziz Al Saud (since 2015); Crown Prince MBS (PM since 2022)",
    population: 35000000,
    gdpUsd: 1061000000000,
    gdpPerCapita: 30300,
    militaryBudgetUsd: 75800000000,
    armedForcesSize: 227000,
    threatLevel: "HIGH",
    nuclearStatus: "none",
    sanctionsStatus: "No comprehensive sanctions. Targeted sanctions by US/EU/UK/Canada on individuals linked to Khashoggi murder (2018).",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "King Salman bin Abdulaziz", role: "King", since: "2015" },
      { name: "Mohammed bin Salman (MBS)", role: "Crown Prince & Prime Minister", since: "2017" },
      { name: "Prince Khalid bin Salman", role: "Minister of Defense", since: "2022" }
    ],
    alliances: ["United States (security partner)", "GCC", "OPEC+", "Arab League", "G20"],
    activeConflicts: [
      { name: "Yemen War", since: "2015", type: "Military intervention", status: "Active — Saudi-led coalition vs Houthi movement; fragile ceasefire in ground war" },
      { name: "Houthi Drone/Missile Attacks", since: "2019", type: "Asymmetric", status: "Ongoing — Houthi attacks on Saudi territory continue" }
    ],
    humanRightsIndex: 0.8,
    pressFreedomIndex: 166,
    corruptionIndex: 53,
    internetFreedom: "not_free",
    keyIntelNotes: "Largest economy in Arab world. OPEC+ de facto leader. Vision 2030 diversification program. Khashoggi murder (2018) strained Western relations. Iran-Saudi normalization deal brokered by China (2023) is a major geopolitical shift. Military budget is one of the world's highest at ~7% of GDP. Freedom House: Not Free (8/100). RSF 2024: ranked 166/180.",
    sources: [
      { name: "CIA World Factbook — Saudi Arabia", url: "https://www.cia.gov/the-world-factbook/countries/saudi-arabia/", date: "2024" },
      { name: "Freedom House 2024 — Saudi Arabia", url: "https://freedomhouse.org/country/saudi-arabia/freedom-world/2024", date: "2024" },
      { name: "RSF Press Freedom Index 2024", url: "https://rsf.org/en/country/saudi-arabia", date: "2024" },
      { name: "SIPRI Military Expenditure 2024", url: "https://www.sipri.org/databases/milex", date: "2024" },
      { name: "TI CPI 2024 — Saudi Arabia", url: "https://www.transparency.org/en/countries/saudi-arabia", date: "2024" }
    ]
  },
  {
    country: "Iran",
    isoA3: "IRN",
    region: "Middle East",
    capital: "Tehran",
    governmentType: "Islamic Republic (theocratic-republican hybrid)",
    headOfState: "Supreme Leader Ali Khamenei (since 1989); President Masoud Pezeshkian (since 2024)",
    population: 87000000,
    gdpUsd: 367000000000,
    gdpPerCapita: 4200,
    militaryBudgetUsd: 10300000000,
    armedForcesSize: 610000,
    threatLevel: "CRITICAL",
    nuclearStatus: "suspected",
    sanctionsStatus: "Comprehensive US (OFAC) and EU sanctions on government, IRGC, energy sector. UN arms embargo (UNSCR 2231). Financial system largely isolated from SWIFT.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Ali Khamenei", role: "Supreme Leader", since: "1989" },
      { name: "Masoud Pezeshkian", role: "President", since: "2024" },
      { name: "General Hossein Salami", role: "IRGC Commander-in-Chief", since: "2019" },
      { name: "Esmail Qaani", role: "IRGC-Quds Force Commander", since: "2020" }
    ],
    alliances: ["Russia (military cooperation)", "China (25-year strategic deal)", "Hezbollah", "Houthis (Yemen)", "PMF (Iraq)", "Hamas (Gaza)"],
    activeConflicts: [
      { name: "Proxy Network Operations", since: "1979", type: "Proxy warfare", status: "Active — IRGC-Quds Force operates proxy network across Lebanon, Iraq, Syria, Yemen, Gaza" },
      { name: "Nuclear Program Standoff", since: "2002", type: "Strategic/Diplomatic", status: "Critical — enriching to 60% (near weapons-grade); IAEA safeguards violations; breakout capability assessed at weeks" },
      { name: "Direct Strike on Israel", since: "2024", type: "Direct military", status: "April 2024 — first direct Iranian missile/drone attack on Israeli territory (300+ projectiles)" }
    ],
    humanRightsIndex: 1.4,
    pressFreedomIndex: 176,
    corruptionIndex: 24,
    internetFreedom: "not_free",
    keyIntelNotes: "Iran's nuclear program is the most significant proliferation concern in the region. JCPOA (2015) collapsed after US withdrawal (2018). Iran now enriches uranium to 60%, assessed as weeks from weapons-grade. IRGC operates a vast proxy network ('Axis of Resistance'). April 2024: first direct Iranian strike on Israel (300+ drones/missiles). IRGC designated FTO by US. SCO full member (2023), BRICS (2024). Freedom House: Not Free (14/100). RSF 2024: ranked 176/180.",
    sources: [
      { name: "CIA World Factbook — Iran", url: "https://www.cia.gov/the-world-factbook/countries/iran/", date: "2024" },
      { name: "IAEA Iran Nuclear Reports", url: "https://www.iaea.org/newscenter/focus/iran", date: "2024" },
      { name: "Freedom House 2024 — Iran", url: "https://freedomhouse.org/country/iran/freedom-world/2024", date: "2024" },
      { name: "RSF Press Freedom Index 2024", url: "https://rsf.org/en/country/iran", date: "2024" },
      { name: "US State Dept — Iran Sanctions", url: "https://www.state.gov/iran-sanctions/", date: "2024" },
      { name: "SIPRI Military Expenditure 2024", url: "https://www.sipri.org/databases/milex", date: "2024" }
    ]
  },
  {
    country: "Israel",
    isoA3: "ISR",
    region: "Levant",
    capital: "Jerusalem (disputed; Tel Aviv recognized by most states)",
    governmentType: "Parliamentary democracy",
    headOfState: "President Isaac Herzog (since 2021); PM Benjamin Netanyahu (since 2022)",
    population: 9700000,
    gdpUsd: 509000000000,
    gdpPerCapita: 52500,
    militaryBudgetUsd: 27500000000,
    armedForcesSize: 169500,
    threatLevel: "CRITICAL",
    nuclearStatus: "confirmed",
    sanctionsStatus: "No comprehensive sanctions. ICC arrest warrants for PM Netanyahu and former Defense Minister Gallant (Nov 2024) for Gaza war crimes.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Benjamin Netanyahu", role: "Prime Minister", since: "2022" },
      { name: "Isaac Herzog", role: "President", since: "2021" },
      { name: "Israel Katz", role: "Defense Minister", since: "2024" }
    ],
    alliances: ["United States (primary security guarantor)", "Abraham Accords states (UAE, Bahrain, Morocco, Sudan)", "Germany", "UK"],
    activeConflicts: [
      { name: "Gaza War", since: "2023", type: "Military operation", status: "Active since Oct 7, 2023 — IDF operations in Gaza; 40,000+ Palestinian deaths (UN OCHA)" },
      { name: "West Bank Operations", since: "2023", type: "Military/Occupation", status: "Ongoing — increased IDF operations; settler violence escalating" },
      { name: "Lebanon-Hezbollah War", since: "2023", type: "Military", status: "Ceasefire Nov 2024 — Hezbollah significantly degraded; Nasrallah killed Sep 2024" },
      { name: "Iran Confrontation", since: "2024", type: "Direct military exchange", status: "Escalated — Iran direct attack Apr 2024; Israeli counter-strike Oct 2024" }
    ],
    humanRightsIndex: 7.7,
    pressFreedomIndex: 101,
    corruptionIndex: 64,
    internetFreedom: "free",
    keyIntelNotes: "Israel has been in active multi-front war since Hamas's October 7, 2023 attack (1,200 Israelis killed, 251 taken hostage). Gaza conflict has killed 40,000+ Palestinians (UN OCHA). ICC issued arrest warrants for PM Netanyahu in November 2024. Israel maintains policy of nuclear ambiguity with estimated 90 warheads (SIPRI 2024). Abraham Accords normalized relations with UAE, Bahrain, Morocco, Sudan (2020). Freedom House: Free (77/100) for Israel proper; West Bank/Gaza rated Not Free.",
    sources: [
      { name: "CIA World Factbook — Israel", url: "https://www.cia.gov/the-world-factbook/countries/israel/", date: "2024" },
      { name: "SIPRI Nuclear Forces 2024", url: "https://www.sipri.org/research/armament-and-disarmament/nuclear-disarmament-arms-control-and-non-proliferation/world-nuclear-forces", date: "2024" },
      { name: "Freedom House 2024 — Israel", url: "https://freedomhouse.org/country/israel/freedom-world/2024", date: "2024" },
      { name: "ICC Arrest Warrants — Israel", url: "https://www.icc-cpi.int/news/situation-state-palestine-icc-pre-trial-chamber-i-rejects-state-israels-challenges", date: "2024" },
      { name: "UN OCHA — Gaza Conflict Data", url: "https://www.ochaopt.org/", date: "2024" }
    ]
  },
  {
    country: "Iraq",
    isoA3: "IRQ",
    region: "Middle East",
    capital: "Baghdad",
    governmentType: "Federal parliamentary republic",
    headOfState: "President Abdul Latif Rashid (since 2022); PM Mohammed Shia Al-Sudani (since 2022)",
    population: 42000000,
    gdpUsd: 264000000000,
    gdpPerCapita: 6300,
    militaryBudgetUsd: 4900000000,
    armedForcesSize: 193000,
    threatLevel: "HIGH",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions currently.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Abdul Latif Rashid", role: "President", since: "2022" },
      { name: "Mohammed Shia Al-Sudani", role: "Prime Minister", since: "2022" },
      { name: "Masrour Barzani", role: "KRG Prime Minister", since: "2019" }
    ],
    alliances: ["Iran (dominant influence)", "United States (security partner)", "Arab League"],
    activeConflicts: [
      { name: "ISIS Insurgency", since: "2017", type: "Counterterrorism", status: "Active — ISIS remnants conduct attacks in remote areas" },
      { name: "PMF-US Tensions", since: "2019", type: "Proxy conflict", status: "Ongoing — Iran-backed PMF attacks on US forces; US retaliatory strikes" },
      { name: "Kurdish-Baghdad Tensions", since: "2017", type: "Political/Military", status: "Ongoing — KRG oil exports, budget disputes, Peshmerga coordination" }
    ],
    humanRightsIndex: 2.9,
    pressFreedomIndex: 169,
    corruptionIndex: 23,
    internetFreedom: "not_free",
    keyIntelNotes: "Iraq is a key battleground for US-Iran competition. The PMF (Iran-backed militias) are designated as a state force but operate semi-independently. ISIS retains insurgent capability in remote areas. The KRG maintains significant autonomy including its own military (Peshmerga) and oil exports. Freedom House: Not Free (29/100). RSF 2024: ranked 169/180.",
    sources: [
      { name: "CIA World Factbook — Iraq", url: "https://www.cia.gov/the-world-factbook/countries/iraq/", date: "2024" },
      { name: "Freedom House 2024 — Iraq", url: "https://freedomhouse.org/country/iraq/freedom-world/2024", date: "2024" },
      { name: "ACLED — Iraq conflict data", url: "https://acleddata.com/data-export-tool/", date: "2024" },
      { name: "UN UNAMI — Iraq", url: "https://unami.unmissions.org/", date: "2024" }
    ]
  },
  {
    country: "Syria",
    isoA3: "SYR",
    region: "Levant",
    capital: "Damascus",
    governmentType: "Transitional government (post-Assad, December 2024)",
    headOfState: "Ahmed al-Sharaa (HTS de facto head of state since Dec 2024)",
    population: 21000000,
    gdpUsd: 60000000000,
    gdpPerCapita: 2900,
    militaryBudgetUsd: 1800000000,
    armedForcesSize: 125000,
    threatLevel: "CRITICAL",
    nuclearStatus: "none",
    sanctionsStatus: "Comprehensive US (Caesar Act) and EU sanctions on Assad regime; some sanctions suspended post-Assad fall (Dec 2024). US Treasury issued 6-month general license for Syria transactions (Jan 2025).",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Ahmed al-Sharaa (Abu Mohammad al-Jolani)", role: "De facto head of state (HTS)", since: "2024" },
      { name: "Mohammed al-Bashir", role: "Transitional Prime Minister", since: "2024" }
    ],
    alliances: ["Turkey (supports HTS-aligned factions)", "Qatar (diplomatic support)"],
    activeConflicts: [
      { name: "Post-Assad Transition", since: "2024", type: "State transition/Reconstruction", status: "Critical — Assad regime collapsed Dec 8, 2024; HTS controls Damascus; multiple factions active" },
      { name: "ISIS Resurgence", since: "2024", type: "Counterterrorism", status: "Active — ISIS exploiting power vacuum in eastern desert" },
      { name: "Turkish-Kurdish Conflict", since: "2016", type: "Military", status: "Ongoing — Turkish-backed SNA vs SDF/YPG in northern Syria" }
    ],
    humanRightsIndex: 0.1,
    pressFreedomIndex: 179,
    corruptionIndex: 13,
    internetFreedom: "not_free",
    keyIntelNotes: "Assad regime collapsed December 8, 2024 after HTS-led offensive. Syria is in critical transitional phase. HTS (formerly Al-Qaeda affiliate) is designated terrorist organization by US/EU but controls Damascus. Over 6 million Syrians remain as refugees. OPCW documented multiple chemical weapons attacks by Assad regime. Israeli airstrikes destroyed Syrian military assets after Assad's fall. Freedom House: Not Free (1/100). RSF 2024: ranked 179/180.",
    sources: [
      { name: "CIA World Factbook — Syria", url: "https://www.cia.gov/the-world-factbook/countries/syria/", date: "2024" },
      { name: "UN OCHA — Syria", url: "https://www.unocha.org/syria", date: "2024" },
      { name: "OPCW — Syria Chemical Weapons", url: "https://www.opcw.org/special-sections/syria", date: "2024" },
      { name: "Freedom House 2024 — Syria", url: "https://freedomhouse.org/country/syria/freedom-world/2024", date: "2024" },
      { name: "ACLED — Syria conflict data", url: "https://acleddata.com/data-export-tool/", date: "2024" }
    ]
  },
  {
    country: "Lebanon",
    isoA3: "LBN",
    region: "Levant",
    capital: "Beirut",
    governmentType: "Parliamentary republic (confessional system)",
    headOfState: "President Joseph Aoun (since January 2025); PM Nawaf Salam (since January 2025)",
    population: 5500000,
    gdpUsd: 22000000000,
    gdpPerCapita: 4000,
    militaryBudgetUsd: 480000000,
    armedForcesSize: 80000,
    threatLevel: "HIGH",
    nuclearStatus: "none",
    sanctionsStatus: "Hezbollah designated FTO by US/EU. Targeted sanctions on individuals. Banking sector under FATF scrutiny. Lebanese pound lost 98% of value since 2019.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Joseph Aoun", role: "President", since: "2025" },
      { name: "Nawaf Salam", role: "Prime Minister", since: "2025" },
      { name: "Naim Qassem", role: "Hezbollah Secretary-General", since: "2024" }
    ],
    alliances: ["Iran (Hezbollah patron)", "France (historical ties)", "Arab League"],
    activeConflicts: [
      { name: "Post-War Reconstruction", since: "2024", type: "Recovery", status: "Ceasefire Nov 2024 — Hezbollah significantly degraded; Nasrallah killed Sep 2024; IDF withdrawal ongoing" },
      { name: "Economic Collapse", since: "2019", type: "Economic crisis", status: "Ongoing — World Bank: one of worst economic collapses in modern history; currency lost 98% value" }
    ],
    humanRightsIndex: 4.3,
    pressFreedomIndex: 140,
    corruptionIndex: 23,
    internetFreedom: "partly_free",
    keyIntelNotes: "Lebanon experienced one of the worst economic collapses in modern history (World Bank). Beirut port explosion (2020) killed 218 people. Hezbollah was significantly degraded in 2024 war with Israel — Nasrallah killed September 2024. Ceasefire reached November 2024. New president and PM elected January 2025 signal potential political reset. Freedom House: Partly Free (43/100). RSF 2024: ranked 140/180.",
    sources: [
      { name: "CIA World Factbook — Lebanon", url: "https://www.cia.gov/the-world-factbook/countries/lebanon/", date: "2024" },
      { name: "World Bank — Lebanon Economic Crisis", url: "https://www.worldbank.org/en/country/lebanon/overview", date: "2024" },
      { name: "UN UNIFIL — Lebanon", url: "https://unifil.unmissions.org/", date: "2024" },
      { name: "Freedom House 2024 — Lebanon", url: "https://freedomhouse.org/country/lebanon/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Jordan",
    isoA3: "JOR",
    region: "Levant",
    capital: "Amman",
    governmentType: "Constitutional monarchy",
    headOfState: "King Abdullah II (since 1999); PM Jafar Hassan (since 2024)",
    population: 10800000,
    gdpUsd: 50000000000,
    gdpPerCapita: 4600,
    militaryBudgetUsd: 2100000000,
    armedForcesSize: 100500,
    threatLevel: "MODERATE",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "King Abdullah II", role: "King", since: "1999" },
      { name: "Crown Prince Hussein", role: "Crown Prince", since: "2021" },
      { name: "Jafar Hassan", role: "Prime Minister", since: "2024" }
    ],
    alliances: ["United States (key partner, $1.45B annual aid)", "Israel (Wadi Araba Treaty)", "Saudi Arabia", "GCC"],
    activeConflicts: [
      { name: "Border Security", since: "2021", type: "Border security", status: "Ongoing — drug/weapons smuggling from Syria; ISIS infiltration attempts" }
    ],
    humanRightsIndex: 3.3,
    pressFreedomIndex: 132,
    corruptionIndex: 49,
    internetFreedom: "partly_free",
    keyIntelNotes: "Jordan is a key US partner hosting the largest Palestinian refugee population per capita. King Abdullah intercepted Iranian drones targeting Israel in April 2024, demonstrating Jordan's security role. Jordan hosts 700,000+ registered Syrian refugees. Wadi Araba Treaty (1994) normalized relations with Israel. Freedom House: Not Free (33/100). RSF 2024: ranked 132/180.",
    sources: [
      { name: "CIA World Factbook — Jordan", url: "https://www.cia.gov/the-world-factbook/countries/jordan/", date: "2024" },
      { name: "Freedom House 2024 — Jordan", url: "https://freedomhouse.org/country/jordan/freedom-world/2024", date: "2024" },
      { name: "UNHCR — Jordan Refugees", url: "https://www.unhcr.org/countries/jordan", date: "2024" }
    ]
  },
  {
    country: "United Arab Emirates",
    isoA3: "ARE",
    region: "Gulf",
    capital: "Abu Dhabi",
    governmentType: "Federal absolute monarchy (federation of 7 emirates)",
    headOfState: "President Sheikh Mohamed bin Zayed Al Nahyan (MBZ, since 2022)",
    population: 9900000,
    gdpUsd: 509000000000,
    gdpPerCapita: 51400,
    militaryBudgetUsd: 22800000000,
    armedForcesSize: 63000,
    threatLevel: "LOW",
    nuclearStatus: "civilian",
    sanctionsStatus: "No major international sanctions. Removed from FATF grey list (2024). Barakah nuclear plant operational under IAEA safeguards.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Sheikh Mohamed bin Zayed (MBZ)", role: "President / Abu Dhabi ruler", since: "2022" },
      { name: "Sheikh Mohammed bin Rashid (MBR)", role: "PM / Dubai ruler", since: "2006" },
      { name: "Sheikh Khaled bin Mohamed", role: "Abu Dhabi Crown Prince", since: "2023" }
    ],
    alliances: ["United States (CENTCOM operations)", "France", "UK", "Israel (Abraham Accords 2020)", "GCC"],
    activeConflicts: [],
    humanRightsIndex: 1.8,
    pressFreedomIndex: 155,
    corruptionIndex: 68,
    internetFreedom: "not_free",
    keyIntelNotes: "UAE is the most economically diversified Gulf state. Dubai is a global financial and logistics hub. Normalized relations with Israel in 2020 (Abraham Accords). Barakah nuclear plant (4 reactors) is the Arab world's first operational nuclear power station. UAE removed from FATF grey list in 2024. Withdrew from Yemen coalition (2019). Freedom House: Not Free (18/100). RSF 2024: ranked 155/180.",
    sources: [
      { name: "CIA World Factbook — UAE", url: "https://www.cia.gov/the-world-factbook/countries/united-arab-emirates/", date: "2024" },
      { name: "Freedom House 2024 — UAE", url: "https://freedomhouse.org/country/united-arab-emirates/freedom-world/2024", date: "2024" },
      { name: "IAEA — UAE Nuclear", url: "https://www.iaea.org/newscenter/news/uae-nuclear-power", date: "2024" }
    ]
  },
  {
    country: "Yemen",
    isoA3: "YEM",
    region: "Arabian Peninsula",
    capital: "Sanaa (Houthi-controlled) / Aden (internationally recognized government)",
    governmentType: "Divided state — internationally recognized government vs Houthi authority",
    headOfState: "Presidential Leadership Council Chair Rashad al-Alimi (since 2022)",
    population: 34000000,
    gdpUsd: 21000000000,
    gdpPerCapita: 620,
    militaryBudgetUsd: 600000000,
    armedForcesSize: 30000,
    threatLevel: "CRITICAL",
    nuclearStatus: "none",
    sanctionsStatus: "Houthi leadership under UN/US/EU targeted sanctions. UN arms embargo. US designated Houthis as Specially Designated Global Terrorist (SDGT) organization.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Rashad al-Alimi", role: "Presidential Leadership Council Chair", since: "2022" },
      { name: "Abdul-Malik al-Houthi", role: "Houthi Supreme Leader", since: "2004" }
    ],
    alliances: ["Saudi Arabia (recognized government)", "UAE (STC support)", "Iran (Houthi patron)"],
    activeConflicts: [
      { name: "Yemen Civil War", since: "2015", type: "Civil war / Proxy war", status: "Active — Houthis control northwest; fragile ground ceasefire; Saudi-led coalition intervention" },
      { name: "Red Sea Shipping Attacks", since: "2023", type: "Maritime terrorism", status: "Active since Nov 2023 — Houthis attacking commercial vessels; US/UK strikes on Houthi targets (Operation Prosperity Guardian)" }
    ],
    humanRightsIndex: 1.1,
    pressFreedomIndex: 154,
    corruptionIndex: 16,
    internetFreedom: "not_free",
    keyIntelNotes: "Yemen is experiencing the world's worst humanitarian crisis (UN). 21M+ people need humanitarian assistance. Houthis began attacking Red Sea shipping in November 2023 in solidarity with Gaza, disrupting ~12% of global trade. US and UK launched Operation Prosperity Guardian. AQAP remains active. Freedom House: Not Free (11/100). RSF 2024: ranked 154/180.",
    sources: [
      { name: "CIA World Factbook — Yemen", url: "https://www.cia.gov/the-world-factbook/countries/yemen/", date: "2024" },
      { name: "UN OCHA — Yemen", url: "https://www.unocha.org/yemen", date: "2024" },
      { name: "ACLED — Yemen conflict data", url: "https://acleddata.com/data-export-tool/", date: "2024" },
      { name: "Freedom House 2024 — Yemen", url: "https://freedomhouse.org/country/yemen/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Libya",
    isoA3: "LBY",
    region: "North Africa",
    capital: "Tripoli (GNU) / Benghazi (LNA)",
    governmentType: "Divided state — GNU in west vs LNA in east",
    headOfState: "GNU PM Abdul Hamid Dbeibah (Tripoli); LNA Field Marshal Khalifa Haftar (Benghazi)",
    population: 7000000,
    gdpUsd: 83000000000,
    gdpPerCapita: 11900,
    militaryBudgetUsd: 1500000000,
    armedForcesSize: 35000,
    threatLevel: "HIGH",
    nuclearStatus: "none",
    sanctionsStatus: "UN arms embargo on Libya. Targeted sanctions on individuals. Oil revenues disputed between GNU and LNA.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Abdul Hamid Dbeibah", role: "GNU Prime Minister (Tripoli)", since: "2021" },
      { name: "Khalifa Haftar", role: "LNA Commander (Benghazi)", since: "2014" }
    ],
    alliances: ["Turkey (GNU)", "UAE/Egypt (LNA)", "Russia/Wagner (LNA)"],
    activeConflicts: [
      { name: "GNU-LNA Frozen Conflict", since: "2014", type: "Civil war / Proxy war", status: "Frozen — October 2020 ceasefire holding; political reunification not achieved; foreign forces present" },
      { name: "ISIS/AQIM Activity", since: "2014", type: "Counterterrorism", status: "Active — ISIS remnants in southern desert; AQIM in western border areas" }
    ],
    humanRightsIndex: 0.9,
    pressFreedomIndex: 143,
    corruptionIndex: 18,
    internetFreedom: "not_free",
    keyIntelNotes: "Libya remains divided between GNU in Tripoli and LNA in Benghazi since 2014. October 2020 ceasefire holds but political reunification has not been achieved. Libya is a major transit point for sub-Saharan African migration to Europe. Russian Wagner Group forces present in eastern Libya. Oil revenues are the main source of conflict. Freedom House: Not Free (9/100). RSF 2024: ranked 143/180.",
    sources: [
      { name: "CIA World Factbook — Libya", url: "https://www.cia.gov/the-world-factbook/countries/libya/", date: "2024" },
      { name: "UN Panel of Experts — Libya", url: "https://www.un.org/securitycouncil/sanctions/1970/panel-of-experts", date: "2024" },
      { name: "Freedom House 2024 — Libya", url: "https://freedomhouse.org/country/libya/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Tunisia",
    isoA3: "TUN",
    region: "North Africa",
    capital: "Tunis",
    governmentType: "Presidential republic (increasingly authoritarian)",
    headOfState: "President Kais Saied (since 2019); PM Kamel Maddouri (since 2024)",
    population: 12000000,
    gdpUsd: 46000000000,
    gdpPerCapita: 3800,
    militaryBudgetUsd: 1000000000,
    armedForcesSize: 35800,
    threatLevel: "MODERATE",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions. IMF bailout negotiations stalled ($1.9B program).",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Kais Saied", role: "President", since: "2019" },
      { name: "Kamel Maddouri", role: "Prime Minister", since: "2024" }
    ],
    alliances: ["European Union (association agreement)", "United States", "Arab League"],
    activeConflicts: [
      { name: "Jihadist Threat", since: "2011", type: "Counterterrorism", status: "Low-level — AQIM affiliates in western mountains; ISIS-affiliated cells" }
    ],
    humanRightsIndex: 4.3,
    pressFreedomIndex: 118,
    corruptionIndex: 43,
    internetFreedom: "partly_free",
    keyIntelNotes: "Tunisia was the only successful Arab Spring democracy (2011-2021) before President Saied's self-coup in 2021. New 2022 constitution concentrates power in presidency. Tunisia is a major departure point for Mediterranean migration to Europe. IMF negotiations for $1.9B bailout stalled. Freedom House: Partly Free (43/100). RSF 2024: ranked 118/180.",
    sources: [
      { name: "CIA World Factbook — Tunisia", url: "https://www.cia.gov/the-world-factbook/countries/tunisia/", date: "2024" },
      { name: "Freedom House 2024 — Tunisia", url: "https://freedomhouse.org/country/tunisia/freedom-world/2024", date: "2024" },
      { name: "RSF Press Freedom Index 2024", url: "https://rsf.org/en/country/tunisia", date: "2024" }
    ]
  },
  {
    country: "Morocco",
    isoA3: "MAR",
    region: "North Africa",
    capital: "Rabat",
    governmentType: "Constitutional monarchy",
    headOfState: "King Mohammed VI (since 1999); PM Aziz Akhannouch (since 2021)",
    population: 37000000,
    gdpUsd: 142000000000,
    gdpPerCapita: 3800,
    militaryBudgetUsd: 5400000000,
    armedForcesSize: 200000,
    threatLevel: "LOW",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "King Mohammed VI", role: "King", since: "1999" },
      { name: "Aziz Akhannouch", role: "Prime Minister", since: "2021" }
    ],
    alliances: ["United States (major non-NATO ally)", "France", "Spain", "Israel (Abraham Accords 2020)", "Saudi Arabia"],
    activeConflicts: [
      { name: "Western Sahara Dispute", since: "1975", type: "Territorial dispute", status: "Frozen — Morocco controls 70%; Polisario Front backed by Algeria; UN-mediated talks stalled" }
    ],
    humanRightsIndex: 3.7,
    pressFreedomIndex: 129,
    corruptionIndex: 38,
    internetFreedom: "partly_free",
    keyIntelNotes: "Morocco controls 70% of Western Sahara and its phosphate reserves (~70% of global reserves). US recognized Moroccan sovereignty over Western Sahara in 2020 as part of Abraham Accords. Normalized relations with Israel in 2020. 2023 earthquake (Al Haouz) killed 2,900+. Freedom House: Not Free (37/100). RSF 2024: ranked 129/180.",
    sources: [
      { name: "CIA World Factbook — Morocco", url: "https://www.cia.gov/the-world-factbook/countries/morocco/", date: "2024" },
      { name: "Freedom House 2024 — Morocco", url: "https://freedomhouse.org/country/morocco/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Algeria",
    isoA3: "DZA",
    region: "North Africa",
    capital: "Algiers",
    governmentType: "Presidential republic (military-backed)",
    headOfState: "President Abdelmadjid Tebboune (since 2019, re-elected 2024); PM Nadir Larbaoui (since 2023)",
    population: 45000000,
    gdpUsd: 239000000000,
    gdpPerCapita: 5300,
    militaryBudgetUsd: 9300000000,
    armedForcesSize: 130000,
    threatLevel: "MODERATE",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Abdelmadjid Tebboune", role: "President", since: "2019" },
      { name: "Nadir Larbaoui", role: "Prime Minister", since: "2023" }
    ],
    alliances: ["Russia (arms supplier)", "China", "EU (gas supplier)", "Arab League", "African Union"],
    activeConflicts: [
      { name: "Sahel Jihadist Threat", since: "2013", type: "Counterterrorism", status: "Active — AQIM/ISIS Sahel spillover from Mali/Niger border" }
    ],
    humanRightsIndex: 3.4,
    pressFreedomIndex: 139,
    corruptionIndex: 36,
    internetFreedom: "not_free",
    keyIntelNotes: "Algeria is Africa's largest country by area and a major natural gas supplier to Europe. Hirak protest movement (2019-2021) suppressed. Algeria broke diplomatic relations with Morocco in 2021 over Western Sahara. Algeria is a key transit route for Sahel migration and counterterrorism partner. Freedom House: Not Free (34/100). RSF 2024: ranked 139/180.",
    sources: [
      { name: "CIA World Factbook — Algeria", url: "https://www.cia.gov/the-world-factbook/countries/algeria/", date: "2024" },
      { name: "Freedom House 2024 — Algeria", url: "https://freedomhouse.org/country/algeria/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Qatar",
    isoA3: "QAT",
    region: "Gulf",
    capital: "Doha",
    governmentType: "Absolute monarchy",
    headOfState: "Emir Sheikh Tamim bin Hamad Al Thani (since 2013); PM Sheikh Mohammed bin Abdulrahman Al Thani (since 2023)",
    population: 2900000,
    gdpUsd: 235000000000,
    gdpPerCapita: 81400,
    militaryBudgetUsd: 6600000000,
    armedForcesSize: 16000,
    threatLevel: "LOW",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions. GCC blockade (2017-2021) lifted.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Sheikh Tamim bin Hamad Al Thani", role: "Emir", since: "2013" },
      { name: "Sheikh Mohammed bin Abdulrahman Al Thani", role: "Prime Minister & Foreign Minister", since: "2023" }
    ],
    alliances: ["United States (Al Udeid Air Base — largest US base in MENA)", "Turkey", "Arab League"],
    activeConflicts: [],
    humanRightsIndex: 2.6,
    pressFreedomIndex: 84,
    corruptionIndex: 58,
    internetFreedom: "not_free",
    keyIntelNotes: "Qatar hosts the largest US military base in the Middle East (Al Udeid, ~10,000 US personnel). World's largest LNG exporter. Hosts Hamas political bureau and has been key mediator in Gaza ceasefire negotiations. Al Jazeera Media Network is state-funded. Hosted 2022 FIFA World Cup. Freedom House: Not Free (26/100). RSF 2024: ranked 84/180 (best in MENA).",
    sources: [
      { name: "CIA World Factbook — Qatar", url: "https://www.cia.gov/the-world-factbook/countries/qatar/", date: "2024" },
      { name: "Freedom House 2024 — Qatar", url: "https://freedomhouse.org/country/qatar/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Kuwait",
    isoA3: "KWT",
    region: "Gulf",
    capital: "Kuwait City",
    governmentType: "Constitutional emirate",
    headOfState: "Emir Sheikh Mishal Al-Ahmad Al-Sabah (since 2023); PM Sheikh Ahmad Al-Abdullah Al-Sabah (since 2024)",
    population: 4300000,
    gdpUsd: 161000000000,
    gdpPerCapita: 37400,
    militaryBudgetUsd: 8800000000,
    armedForcesSize: 17500,
    threatLevel: "LOW",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Sheikh Mishal Al-Ahmad Al-Sabah", role: "Emir", since: "2023" },
      { name: "Sheikh Ahmad Al-Abdullah Al-Sabah", role: "Prime Minister", since: "2024" }
    ],
    alliances: ["United States (Camp Arifjan, Ali Al Salem Air Base)", "GCC", "Arab League"],
    activeConflicts: [],
    humanRightsIndex: 3.6,
    pressFreedomIndex: 131,
    corruptionIndex: 46,
    internetFreedom: "not_free",
    keyIntelNotes: "Kuwait was invaded by Iraq in 1990, liberated by US-led coalition in 1991 (Gulf War). Kuwait has the world's 6th largest oil reserves. Kuwait's parliament is one of the most active in the Gulf, frequently blocking government budgets and causing political deadlock. Freedom House: Partly Free (36/100). RSF 2024: ranked 131/180.",
    sources: [
      { name: "CIA World Factbook — Kuwait", url: "https://www.cia.gov/the-world-factbook/countries/kuwait/", date: "2024" },
      { name: "Freedom House 2024 — Kuwait", url: "https://freedomhouse.org/country/kuwait/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Bahrain",
    isoA3: "BHR",
    region: "Gulf",
    capital: "Manama",
    governmentType: "Constitutional monarchy",
    headOfState: "King Hamad bin Isa Al Khalifa (since 2002); Crown Prince Salman bin Hamad Al Khalifa (PM since 2020)",
    population: 1500000,
    gdpUsd: 44000000000,
    gdpPerCapita: 29300,
    militaryBudgetUsd: 1500000000,
    armedForcesSize: 8200,
    threatLevel: "MODERATE",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "King Hamad bin Isa Al Khalifa", role: "King", since: "2002" },
      { name: "Crown Prince Salman bin Hamad Al Khalifa", role: "Prime Minister", since: "2020" }
    ],
    alliances: ["United States (US Fifth Fleet/NAVCENT HQ)", "Saudi Arabia", "GCC", "Israel (Abraham Accords 2020)"],
    activeConflicts: [],
    humanRightsIndex: 1.2,
    pressFreedomIndex: 168,
    corruptionIndex: 42,
    internetFreedom: "not_free",
    keyIntelNotes: "Bahrain hosts the US Fifth Fleet (NAVCENT), the most important US naval base in the Middle East. Shia majority (60-70%) ruled by Sunni monarchy creates persistent sectarian tensions. Iran accused of supporting Shia opposition groups. Normalized relations with Israel in 2020 (Abraham Accords). 2011 Arab Spring protests suppressed with Saudi military assistance. Freedom House: Not Free (12/100). RSF 2024: ranked 168/180.",
    sources: [
      { name: "CIA World Factbook — Bahrain", url: "https://www.cia.gov/the-world-factbook/countries/bahrain/", date: "2024" },
      { name: "Freedom House 2024 — Bahrain", url: "https://freedomhouse.org/country/bahrain/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Oman",
    isoA3: "OMN",
    region: "Gulf",
    capital: "Muscat",
    governmentType: "Absolute monarchy (sultanate)",
    headOfState: "Sultan Haitham bin Tariq Al Said (since 2020)",
    population: 4600000,
    gdpUsd: 108000000000,
    gdpPerCapita: 23500,
    militaryBudgetUsd: 6600000000,
    armedForcesSize: 42600,
    threatLevel: "LOW",
    nuclearStatus: "none",
    sanctionsStatus: "No major international sanctions.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Sultan Haitham bin Tariq Al Said", role: "Sultan", since: "2020" }
    ],
    alliances: ["United Kingdom (historical)", "United States", "GCC", "Arab League"],
    activeConflicts: [],
    humanRightsIndex: 2.3,
    pressFreedomIndex: 134,
    corruptionIndex: 55,
    internetFreedom: "not_free",
    keyIntelNotes: "Oman is known for its neutral foreign policy and has historically served as a backchannel between Iran and the West (including facilitating early JCPOA negotiations). Oman did not join the Saudi-led blockade of Qatar (2017). Sultan Haitham succeeded Sultan Qaboos (who ruled 50 years) in January 2020. Oman controls the Strait of Hormuz (with Iran), through which ~20% of global oil passes. Freedom House: Not Free (23/100). RSF 2024: ranked 134/180.",
    sources: [
      { name: "CIA World Factbook — Oman", url: "https://www.cia.gov/the-world-factbook/countries/oman/", date: "2024" },
      { name: "Freedom House 2024 — Oman", url: "https://freedomhouse.org/country/oman/freedom-world/2024", date: "2024" }
    ]
  },
  {
    country: "Palestine",
    isoA3: "PSE",
    region: "Levant",
    capital: "Ramallah (PA) / Gaza City (Hamas)",
    governmentType: "Divided authority — PA in West Bank; Hamas in Gaza",
    headOfState: "President Mahmoud Abbas (PA, since 2005); PM Mohammad Mustafa (PA, since 2024)",
    population: 5300000,
    gdpUsd: 18000000000,
    gdpPerCapita: 3400,
    militaryBudgetUsd: 0,
    armedForcesSize: 0,
    threatLevel: "CRITICAL",
    nuclearStatus: "none",
    sanctionsStatus: "Hamas designated FTO by US/EU. Hamas leadership under targeted sanctions. Gaza under blockade since 2007.",
    unMemberStatus: "Non-member observer state",
    keyLeaders: [
      { name: "Mahmoud Abbas (Abu Mazen)", role: "PA President", since: "2005" },
      { name: "Mohammad Mustafa", role: "PA Prime Minister", since: "2024" },
      { name: "Yahya Sinwar (killed Oct 2024)", role: "Hamas Gaza leader (deceased)", since: "2017" }
    ],
    alliances: ["Arab League", "OIC", "Iran (Hamas)", "Qatar (Hamas political bureau)"],
    activeConflicts: [
      { name: "Gaza War", since: "2023", type: "Military operation / Humanitarian crisis", status: "Active since Oct 7, 2023 — 40,000+ Palestinian deaths; ICJ genocide investigation; humanitarian catastrophe" },
      { name: "West Bank Violence", since: "2023", type: "Occupation / Settler violence", status: "Escalating — increased IDF operations; settler violence; annexation pressure" }
    ],
    humanRightsIndex: 1.8,
    pressFreedomIndex: 157,
    corruptionIndex: 34,
    internetFreedom: "not_free",
    keyIntelNotes: "Gaza has been under Israeli military operation since Hamas's October 7, 2023 attack (1,200 Israelis killed, 251 taken hostage). Over 40,000 Palestinians killed (UN OCHA). ICJ investigating genocide allegations (South Africa v. Israel). Hamas military leadership significantly degraded — Yahya Sinwar killed October 2024, Mohammed Deif killed July 2024. 143 UN member states recognize Palestinian statehood. Freedom House: Not Free (18/100). RSF 2024: ranked 157/180 (most dangerous for journalists).",
    sources: [
      { name: "UN OCHA — oPt (Gaza)", url: "https://www.ochaopt.org/", date: "2024" },
      { name: "ICJ — South Africa v. Israel (Genocide case)", url: "https://www.icj-cij.org/case/192", date: "2024" },
      { name: "Freedom House 2024 — Palestine", url: "https://freedomhouse.org/country/palestine/freedom-world/2024", date: "2024" },
      { name: "CIA World Factbook — West Bank", url: "https://www.cia.gov/the-world-factbook/countries/west-bank/", date: "2024" }
    ]
  },
  {
    country: "Turkey",
    isoA3: "TUR",
    region: "Middle East / Europe",
    capital: "Ankara",
    governmentType: "Presidential republic",
    headOfState: "President Recep Tayyip Erdogan (since 2014); executive presidency since 2018",
    population: 85000000,
    gdpUsd: 1108000000000,
    gdpPerCapita: 13000,
    militaryBudgetUsd: 40600000000,
    armedForcesSize: 355000,
    threatLevel: "MODERATE",
    nuclearStatus: "treaty",
    sanctionsStatus: "US CAATSA Section 231 sanctions on Turkish defense procurement agency (SSB) for S-400 purchase from Russia. No comprehensive sanctions.",
    unMemberStatus: "Member",
    keyLeaders: [
      { name: "Recep Tayyip Erdogan", role: "President", since: "2014" },
      { name: "Hakan Fidan", role: "Foreign Minister", since: "2023" },
      { name: "Yasar Guler", role: "Chief of General Staff", since: "2023" }
    ],
    alliances: ["NATO (member since 1952)", "Azerbaijan", "Pakistan", "Qatar"],
    activeConflicts: [
      { name: "PKK Insurgency", since: "1984", type: "Counterterrorism", status: "Active — PKK operations in southeast Turkey and northern Iraq/Syria" },
      { name: "Syria Operations", since: "2016", type: "Military intervention", status: "Ongoing — Turkish forces in northern Syria; operations against SDF/YPG" }
    ],
    humanRightsIndex: 3.2,
    pressFreedomIndex: 158,
    corruptionIndex: 34,
    internetFreedom: "not_free",
    keyIntelNotes: "Turkey is a NATO member but purchased Russia's S-400 air defense system, triggering US CAATSA sanctions and removal from F-35 program. Turkey controls the Bosphorus and Dardanelles straits (Montreux Convention), critical for Black Sea access. Turkey has the second largest NATO military. Erdogan played key mediation role in Ukraine-Russia conflict. NATO nuclear sharing (US B61 bombs at Incirlik Air Base). Freedom House: Not Free (32/100). RSF 2024: ranked 158/180.",
    sources: [
      { name: "CIA World Factbook — Turkey", url: "https://www.cia.gov/the-world-factbook/countries/turkey/", date: "2024" },
      { name: "Freedom House 2024 — Turkey", url: "https://freedomhouse.org/country/turkey/freedom-world/2024", date: "2024" },
      { name: "SIPRI Military Expenditure 2024", url: "https://www.sipri.org/databases/milex", date: "2024" }
    ]
  }
];

async function seed() {
  const connection = await mysql.createConnection(DB_URL);
  console.log("Connected to database");

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const c of MENA_COUNTRIES) {
    try {
      // Check if exists
      const [rows] = await connection.execute(
        "SELECT id FROM country_intel_data WHERE country = ?",
        [c.country]
      );

      const now = new Date();

      if (rows.length > 0) {
        await connection.execute(
          `UPDATE country_intel_data SET
            isoA3=?, region=?, capital=?, governmentType=?, headOfState=?,
            population=?, gdpUsd=?, gdpPerCapita=?, militaryBudgetUsd=?, armedForcesSize=?,
            threatLevel=?, nuclearStatus=?, sanctionsStatus=?, unMemberStatus=?,
            keyLeaders=?, alliances=?, activeConflicts=?,
            humanRightsIndex=?, pressFreedomIndex=?, corruptionIndex=?, internetFreedom=?,
            keyIntelNotes=?, sources=?, lastUpdated=?, updatedAt=?
          WHERE country=?`,
          [
            c.isoA3, c.region, c.capital, c.governmentType, c.headOfState,
            c.population, c.gdpUsd, c.gdpPerCapita, c.militaryBudgetUsd, c.armedForcesSize,
            c.threatLevel, c.nuclearStatus, c.sanctionsStatus, c.unMemberStatus,
            JSON.stringify(c.keyLeaders), JSON.stringify(c.alliances), JSON.stringify(c.activeConflicts),
            c.humanRightsIndex, c.pressFreedomIndex, c.corruptionIndex, c.internetFreedom,
            c.keyIntelNotes, JSON.stringify(c.sources), now, now,
            c.country
          ]
        );
        updated++;
        console.log(`  Updated: ${c.country}`);
      } else {
        await connection.execute(
          `INSERT INTO country_intel_data (
            country, isoA3, region, capital, governmentType, headOfState,
            population, gdpUsd, gdpPerCapita, militaryBudgetUsd, armedForcesSize,
            threatLevel, nuclearStatus, sanctionsStatus, unMemberStatus,
            keyLeaders, alliances, activeConflicts,
            humanRightsIndex, pressFreedomIndex, corruptionIndex, internetFreedom,
            keyIntelNotes, sources, lastUpdated, createdAt, updatedAt
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            c.country, c.isoA3, c.region, c.capital, c.governmentType, c.headOfState,
            c.population, c.gdpUsd, c.gdpPerCapita, c.militaryBudgetUsd, c.armedForcesSize,
            c.threatLevel, c.nuclearStatus, c.sanctionsStatus, c.unMemberStatus,
            JSON.stringify(c.keyLeaders), JSON.stringify(c.alliances), JSON.stringify(c.activeConflicts),
            c.humanRightsIndex, c.pressFreedomIndex, c.corruptionIndex, c.internetFreedom,
            c.keyIntelNotes, JSON.stringify(c.sources), now, now, now
          ]
        );
        inserted++;
        console.log(`  Inserted: ${c.country}`);
      }
    } catch (err) {
      console.error(`  ERROR for ${c.country}:`, err.message);
      errors++;
    }
  }

  await connection.end();
  console.log(`\nDone. Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
