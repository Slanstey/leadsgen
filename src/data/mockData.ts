import { Lead, Company, NewsItem } from "@/types/lead";

export const mockLeads: Lead[] = [
  {
    id: "1",
    companyName: "Goldfields Mining Corp",
    contactPerson: "James Anderson",
    contactEmail: "j.anderson@goldfields.com",
    role: "Chief Operating Officer (COO)",
    status: "qualified",
    comments: [
      {
        id: "c1",
        text: "Excellent cultural fit, 20+ years experience in mining operations. Expressed strong interest in relocation to Perth.",
        createdAt: new Date("2024-01-15"),
        author: "Mike Chen"
      }
    ],
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-15")
  },
  {
    id: "2",
    companyName: "TechVentures Inc",
    contactPerson: "Dr. Rachel Thompson",
    contactEmail: "r.thompson@techventures.com",
    role: "Vice President of Sustainability",
    status: "in_progress",
    comments: [
      {
        id: "c2",
        text: "PhD in Environmental Engineering. Currently leading ESG initiatives at tech firm, interested in pivoting to mining sector sustainability.",
        createdAt: new Date("2024-01-18"),
        author: "Emma Wilson"
      }
    ],
    createdAt: new Date("2024-01-12"),
    updatedAt: new Date("2024-01-18")
  },
  {
    id: "3",
    companyName: "Horizon Energy Solutions",
    contactPerson: "Marcus Williams",
    contactEmail: "m.williams@horizonenergy.com",
    role: "Chief Financial Officer (CFO)",
    status: "contacted",
    comments: [],
    createdAt: new Date("2024-01-14"),
    updatedAt: new Date("2024-01-16")
  },
  {
    id: "4",
    companyName: "Goldfields Mining Corp",
    contactPerson: "Patricia Moore",
    contactEmail: "p.moore@goldfields.com",
    role: "Executive Vice President of Operations",
    status: "not_contacted",
    comments: [],
    createdAt: new Date("2024-01-16"),
    updatedAt: new Date("2024-01-16")
  },
  {
    id: "5",
    companyName: "NextGen Robotics",
    contactPerson: "David Chen",
    contactEmail: "d.chen@nextgenrobotics.com",
    role: "Chief Technology Officer (CTO)",
    status: "closed_won",
    comments: [
      {
        id: "c3",
        text: "Offer accepted! 25 years in mining technology and automation. Start date confirmed for Feb 1st.",
        createdAt: new Date("2024-01-19"),
        author: "Mike Chen"
      }
    ],
    createdAt: new Date("2024-01-08"),
    updatedAt: new Date("2024-01-19")
  },
  {
    id: "6",
    companyName: "Rio Tinto",
    contactPerson: "Catherine Dubois",
    contactEmail: "c.dubois@riotinto.com",
    role: "Senior Vice President of Exploration",
    status: "qualified",
    comments: [
      {
        id: "c4",
        text: "30 years in mining exploration, led major discoveries in Africa and South America. Very interested in the opportunity.",
        createdAt: new Date("2024-01-20"),
        author: "Sarah Mitchell"
      }
    ],
    createdAt: new Date("2024-01-17"),
    updatedAt: new Date("2024-01-20")
  },
  {
    id: "7",
    companyName: "BHP Group",
    contactPerson: "Robert Singh",
    contactEmail: "r.singh@bhp.com",
    role: "Managing Director - Asia Pacific",
    status: "contacted",
    comments: [],
    createdAt: new Date("2024-01-19"),
    updatedAt: new Date("2024-01-21")
  }
];

export const mockCompanies: Record<string, Company> = {
  "Goldfields Mining Corp": {
    id: "comp1",
    name: "Goldfields Mining Corp",
    location: "Perth, Western Australia",
    annualRevenue: "$2.8 Billion AUD",
    industry: "Mining",
    subIndustry: "Gold and Copper",
    description: "Leading precious metals mining company with operations across Australia and Africa",
    executives: [
      { name: "James Anderson", title: "Chief Executive Officer" },
      { name: "Sarah Johnson", title: "Chief Financial Officer" },
      { name: "Tom Williams", title: "Chief Operating Officer" }
    ]
  },
  "Rio Tinto": {
    id: "comp5",
    name: "Rio Tinto",
    location: "London, United Kingdom / Melbourne, Australia",
    annualRevenue: "$55.6 Billion USD",
    industry: "Mining",
    subIndustry: "Diversified Metals and Minerals",
    description: "Global mining and metals corporation, one of the world's largest producers of iron ore, aluminum, copper, and diamonds",
    executives: [
      { name: "Jakob Stausholm", title: "Chief Executive Officer" },
      { name: "Peter Cunningham", title: "Chief Financial Officer" },
      { name: "Simon Trott", title: "Chief Commercial Officer" }
    ]
  },
  "BHP Group": {
    id: "comp6",
    name: "BHP Group",
    location: "Melbourne, Australia",
    annualRevenue: "$65.1 Billion USD",
    industry: "Mining",
    subIndustry: "Iron Ore, Copper, Coal",
    description: "World's largest mining company by market capitalization, with major operations in iron ore, copper, and petroleum",
    executives: [
      { name: "Mike Henry", title: "Chief Executive Officer" },
      { name: "David Lamont", title: "Chief Financial Officer" },
      { name: "Vandita Pant", title: "Chief Commercial Officer" }
    ]
  },
  "TechVentures Inc": {
    id: "comp2",
    name: "TechVentures Inc",
    location: "San Francisco, CA",
    annualRevenue: "$450 Million USD",
    industry: "Technology",
    subIndustry: "Software as a Service",
    description: "Enterprise software solutions provider focused on cloud-based business intelligence",
    executives: [
      { name: "Rachel Green", title: "CEO" },
      { name: "David Martinez", title: "CTO" },
      { name: "Kevin Lee", title: "VP of Engineering" }
    ]
  },
  "Horizon Energy Solutions": {
    id: "comp3",
    name: "Horizon Energy Solutions",
    location: "Houston, TX",
    annualRevenue: "$3.2 Billion USD",
    industry: "Energy",
    subIndustry: "Renewable Energy",
    description: "Clean energy provider specializing in solar and wind power generation",
    executives: [
      { name: "Patricia Moore", title: "CEO" },
      { name: "Lisa Chen", title: "VP of Operations" },
      { name: "Robert Taylor", title: "CFO" }
    ]
  },
  "NextGen Robotics": {
    id: "comp4",
    name: "NextGen Robotics",
    location: "Boston, MA",
    annualRevenue: "$680 Million USD",
    industry: "Technology",
    subIndustry: "Robotics and AI",
    description: "Advanced robotics and AI solutions for manufacturing and logistics",
    executives: [
      { name: "Dr. Amanda Foster", title: "CEO" },
      { name: "John Smith", title: "Chief Scientist" },
      { name: "Maria Garcia", title: "VP of Product" }
    ]
  }
};

export const mockNews: Record<string, NewsItem[]> = {
  "Rio Tinto": [
    {
      id: "n10",
      title: "Rio Tinto announces $7.5B investment in Simandou iron ore project",
      date: "2024-01-23",
      source: "Bloomberg",
      summary: "Major expansion of Guinea operations expected to produce 120 million tonnes annually by 2028, creating significant leadership opportunities."
    },
    {
      id: "n11",
      title: "Company commits to net-zero emissions by 2050",
      date: "2024-01-15",
      source: "Financial Times",
      summary: "Rio Tinto announces comprehensive decarbonization strategy including renewable energy transition and carbon capture technology."
    },
    {
      id: "n12",
      title: "Record copper production in Mongolia operations",
      date: "2024-01-08",
      source: "Mining Journal",
      summary: "Oyu Tolgoi mine achieves highest quarterly copper production on record, demonstrating operational excellence."
    }
  ],
  "BHP Group": [
    {
      id: "n13",
      title: "BHP reports strong half-year results driven by copper and iron ore",
      date: "2024-01-24",
      source: "Reuters",
      summary: "Company posts underlying profit of $6.6 billion as demand for copper in energy transition drives growth."
    },
    {
      id: "n14",
      title: "Major restructuring creates new executive positions",
      date: "2024-01-17",
      source: "Australian Financial Review",
      summary: "BHP announces organizational changes creating several new C-suite and SVP roles focused on critical minerals and sustainability."
    },
    {
      id: "n15",
      title: "Investment in autonomous mining technology accelerates",
      date: "2024-01-11",
      source: "Mining Technology",
      summary: "BHP accelerates deployment of autonomous trucks and drilling systems across Pilbara operations."
    }
  ],
  "Goldfields Mining Corp": [
    {
      id: "n1",
      title: "Goldfields announces new copper discovery in Western Australia",
      date: "2024-01-20",
      source: "Mining Weekly",
      summary: "The company has identified significant copper deposits in its Kalgoorlie region operations, potentially increasing annual output by 15%."
    },
    {
      id: "n2",
      title: "Q4 earnings beat expectations as gold prices surge",
      date: "2024-01-10",
      source: "Financial Times",
      summary: "Goldfields reported strong Q4 results with revenue up 22% year-over-year, driven by increased production and favorable gold prices."
    },
    {
      id: "n3",
      title: "Company commits to carbon-neutral operations by 2030",
      date: "2024-01-05",
      source: "Reuters",
      summary: "Goldfields announced ambitious sustainability targets including transitioning to renewable energy sources across all mining operations."
    }
  ],
  "TechVentures Inc": [
    {
      id: "n4",
      title: "TechVentures secures $150M Series C funding",
      date: "2024-01-18",
      source: "TechCrunch",
      summary: "The SaaS company raised $150M in Series C funding to expand its AI-powered analytics platform and enter European markets."
    },
    {
      id: "n5",
      title: "New partnership with Fortune 500 retailer announced",
      date: "2024-01-12",
      source: "Business Insider",
      summary: "TechVentures signs major deal with leading retail chain to implement enterprise-wide business intelligence solutions."
    }
  ],
  "Horizon Energy Solutions": [
    {
      id: "n6",
      title: "Horizon breaks ground on largest solar farm in Texas",
      date: "2024-01-22",
      source: "Energy News",
      summary: "Construction begins on 500MW solar facility expected to power 100,000 homes when completed in 2025."
    },
    {
      id: "n7",
      title: "Company wins bid for offshore wind project",
      date: "2024-01-15",
      source: "Bloomberg",
      summary: "Horizon Energy awarded contract for 1.2GW offshore wind development off the coast of Massachusetts."
    }
  ],
  "NextGen Robotics": [
    {
      id: "n8",
      title: "NextGen's warehouse automation system achieves 99.8% accuracy",
      date: "2024-01-21",
      source: "Tech Review",
      summary: "Latest AI-powered robotics system demonstrates industry-leading accuracy in warehouse picking and packing operations."
    },
    {
      id: "n9",
      title: "Partnership with automotive manufacturer expands production",
      date: "2024-01-08",
      source: "Manufacturing Today",
      summary: "Major auto maker selects NextGen's robotic assembly systems for new electric vehicle production line."
    }
  ]
};
