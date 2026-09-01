export type FallbackDistrict = { code: string; name: string; localName: string; fallback: true };

const districts = [
  ["fallback-ahilyanagar", "Ahilyanagar", "अहिल्यानगर"], ["fallback-akola", "Akola", "अकोला"],
  ["fallback-amravati", "Amravati", "अमरावती"], ["fallback-beed", "Beed", "बीड"],
  ["fallback-bhandara", "Bhandara", "भंडारा"], ["fallback-buldhana", "Buldhana", "बुलढाणा"],
  ["fallback-chhatrapati-sambhajinagar", "Chhatrapati Sambhajinagar", "छत्रपती संभाजीनगर"],
  ["fallback-chandrapur", "Chandrapur", "चंद्रपूर"], ["fallback-dharashiv", "Dharashiv", "धाराशिव"],
  ["fallback-dhule", "Dhule", "धुळे"], ["fallback-gadchiroli", "Gadchiroli", "गडचिरोली"],
  ["fallback-gondia", "Gondia", "गोंदिया"], ["fallback-hingoli", "Hingoli", "हिंगोली"],
  ["fallback-jalgaon", "Jalgaon", "जळगाव"], ["fallback-jalna", "Jalna", "जालना"],
  ["fallback-kolhapur", "Kolhapur", "कोल्हापूर"], ["fallback-latur", "Latur", "लातूर"],
  ["fallback-mumbai-city", "Mumbai City", "मुंबई शहर"], ["fallback-mumbai-suburban", "Mumbai Suburban", "मुंबई उपनगर"],
  ["fallback-nagpur", "Nagpur", "नागपूर"], ["fallback-nanded", "Nanded", "नांदेड"],
  ["fallback-nandurbar", "Nandurbar", "नंदुरबार"], ["fallback-nashik", "Nashik", "नाशिक"],
  ["fallback-palghar", "Palghar", "पालघर"], ["fallback-parbhani", "Parbhani", "परभणी"],
  ["fallback-pune", "Pune", "पुणे"], ["fallback-raigad", "Raigad", "रायगड"],
  ["fallback-ratnagiri", "Ratnagiri", "रत्नागिरी"], ["fallback-sangli", "Sangli", "सांगली"],
  ["fallback-satara", "Satara", "सातारा"], ["fallback-sindhudurg", "Sindhudurg", "सिंधुदुर्ग"],
  ["fallback-solapur", "Solapur", "सोलापूर"], ["fallback-thane", "Thane", "ठाणे"],
  ["fallback-wardha", "Wardha", "वर्धा"], ["fallback-washim", "Washim", "वाशिम"],
  ["fallback-yavatmal", "Yavatmal", "यवतमाळ"],
] as const;

export const MAHARASHTRA_DISTRICTS: FallbackDistrict[] = districts.map(([code, name, localName]) => ({ code, name, localName, fallback: true }));

