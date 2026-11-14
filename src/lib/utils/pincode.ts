export interface PinCodeInfo {
  district: string;
  state: string;
  city: string;
}

// Curated high-accuracy lookup map for major Indian postal regions and East Champaran origin
const PIN_CODE_DATABASE: Record<string, PinCodeInfo> = {
  // Brand origin area
  '845427': { district: 'East Champaran', state: 'Bihar', city: 'Patahi / Motihari' },
  '845401': { district: 'East Champaran', state: 'Bihar', city: 'Motihari' },
  '845457': { district: 'East Champaran', state: 'Bihar', city: 'Dhaka' },
  '845415': { district: 'East Champaran', state: 'Bihar', city: 'Chakia' },
  '800001': { district: 'Patna', state: 'Bihar', city: 'Patna' },
  '800020': { district: 'Patna', state: 'Bihar', city: 'Kankarbagh' },
  '842001': { district: 'Muzaffarpur', state: 'Bihar', city: 'Muzaffarpur' },
  // Delhi NCR
  '110001': { district: 'Central Delhi', state: 'Delhi', city: 'Connaught Place' },
  '110019': { district: 'South Delhi', state: 'Delhi', city: 'Kalkaji' },
  '110092': { district: 'East Delhi', state: 'Delhi', city: 'Laxmi Nagar' },
  '201301': { district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh', city: 'Noida' },
  '122001': { district: 'Gurugram', state: 'Haryana', city: 'Gurugram' },
  // Major Metros
  '400001': { district: 'Mumbai', state: 'Maharashtra', city: 'Fort / Mumbai South' },
  '400050': { district: 'Mumbai Suburban', state: 'Maharashtra', city: 'Bandra West' },
  '560001': { district: 'Bengaluru Urban', state: 'Karnataka', city: 'Bengaluru G.P.O.' },
  '560038': { district: 'Bengaluru Urban', state: 'Karnataka', city: 'Indiranagar' },
  '600001': { district: 'Chennai', state: 'Tamil Nadu', city: 'George Town' },
  '700001': { district: 'Kolkata', state: 'West Bengal', city: 'Dalhousie / BBD Bagh' },
  '500001': { district: 'Hyderabad', state: 'Telangana', city: 'Hyderabad G.P.O.' },
  '380001': { district: 'Ahmedabad', state: 'Gujarat', city: 'Ahmedabad' },
  '302001': { district: 'Jaipur', state: 'Rajasthan', city: 'Jaipur G.P.O.' },
  '226001': { district: 'Lucknow', state: 'Uttar Pradesh', city: 'Hazratganj / Lucknow' },
};

// Generic first 2 digit mapping for all Indian Postal Circles
const POSTAL_CIRCLE_MAP: Record<string, { state: string; defaultCity: string }> = {
  '11': { state: 'Delhi', defaultCity: 'Delhi' },
  '12': { state: 'Haryana', defaultCity: 'Faridabad / Gurugram' },
  '13': { state: 'Haryana', defaultCity: 'Ambala / Panipat' },
  '14': { state: 'Punjab', defaultCity: 'Amritsar / Jalandhar' },
  '15': { state: 'Punjab', defaultCity: 'Bathinda / Firozpur' },
  '16': { state: 'Chandigarh', defaultCity: 'Chandigarh' },
  '17': { state: 'Himachal Pradesh', defaultCity: 'Shimla' },
  '18': { state: 'Jammu & Kashmir', defaultCity: 'Jammu' },
  '19': { state: 'Jammu & Kashmir', defaultCity: 'Srinagar' },
  '20': { state: 'Uttar Pradesh', defaultCity: 'Ghaziabad / Noida' },
  '21': { state: 'Uttar Pradesh', defaultCity: 'Prayagraj' },
  '22': { state: 'Uttar Pradesh', defaultCity: 'Varanasi' },
  '24': { state: 'Uttarakhand', defaultCity: 'Dehradun' },
  '26': { state: 'Uttar Pradesh', defaultCity: 'Bareilly' },
  '27': { state: 'Uttar Pradesh', defaultCity: 'Gorakhpur' },
  '28': { state: 'Uttar Pradesh', defaultCity: 'Agra / Jhansi' },
  '30': { state: 'Rajasthan', defaultCity: 'Jaipur' },
  '31': { state: 'Rajasthan', defaultCity: 'Udaipur' },
  '32': { state: 'Rajasthan', defaultCity: 'Kota' },
  '33': { state: 'Rajasthan', defaultCity: 'Bikaner' },
  '34': { state: 'Rajasthan', defaultCity: 'Jodhpur' },
  '36': { state: 'Gujarat', defaultCity: 'Rajkot' },
  '37': { state: 'Gujarat', defaultCity: 'Jamnagar' },
  '38': { state: 'Gujarat', defaultCity: 'Ahmedabad' },
  '39': { state: 'Gujarat', defaultCity: 'Surat / Vadodara' },
  '40': { state: 'Maharashtra', defaultCity: 'Mumbai' },
  '41': { state: 'Maharashtra', defaultCity: 'Pune' },
  '42': { state: 'Maharashtra', defaultCity: 'Nashik' },
  '43': { state: 'Maharashtra', defaultCity: 'Chhatrapati Sambhajinagar' },
  '44': { state: 'Maharashtra', defaultCity: 'Nagpur' },
  '45': { state: 'Madhya Pradesh', defaultCity: 'Indore' },
  '46': { state: 'Madhya Pradesh', defaultCity: 'Bhopal' },
  '47': { state: 'Madhya Pradesh', defaultCity: 'Gwalior' },
  '48': { state: 'Madhya Pradesh', defaultCity: 'Jabalpur' },
  '49': { state: 'Chhattisgarh', defaultCity: 'Raipur' },
  '50': { state: 'Telangana', defaultCity: 'Hyderabad' },
  '51': { state: 'Andhra Pradesh', defaultCity: 'Tirupati / Kurnool' },
  '52': { state: 'Andhra Pradesh', defaultCity: 'Vijayawada' },
  '53': { state: 'Andhra Pradesh', defaultCity: 'Visakhapatnam' },
  '56': { state: 'Karnataka', defaultCity: 'Bengaluru' },
  '57': { state: 'Karnataka', defaultCity: 'Mangaluru / Mysuru' },
  '58': { state: 'Karnataka', defaultCity: 'Hubballi / Belagavi' },
  '59': { state: 'Karnataka', defaultCity: 'Belagavi' },
  '60': { state: 'Tamil Nadu', defaultCity: 'Chennai' },
  '61': { state: 'Tamil Nadu', defaultCity: 'Tiruchirappalli' },
  '62': { state: 'Tamil Nadu', defaultCity: 'Madurai' },
  '63': { state: 'Tamil Nadu', defaultCity: 'Salem / Vellore' },
  '64': { state: 'Tamil Nadu', defaultCity: 'Coimbatore' },
  '67': { state: 'Kerala', defaultCity: 'Kozhikode' },
  '68': { state: 'Kerala', defaultCity: 'Kochi' },
  '69': { state: 'Kerala', defaultCity: 'Thiruvananthapuram' },
  '70': { state: 'West Bengal', defaultCity: 'Kolkata' },
  '71': { state: 'West Bengal', defaultCity: 'Howrah' },
  '72': { state: 'West Bengal', defaultCity: 'Midnapore' },
  '73': { state: 'West Bengal', defaultCity: 'Siliguri' },
  '74': { state: 'West Bengal', defaultCity: 'North 24 Parganas' },
  '75': { state: 'Odisha', defaultCity: 'Bhubaneswar / Cuttack' },
  '76': { state: 'Odisha', defaultCity: 'Berhampur' },
  '77': { state: 'Odisha', defaultCity: 'Sambalpur' },
  '78': { state: 'Assam', defaultCity: 'Guwahati' },
  '79': { state: 'North Eastern States', defaultCity: 'Shillong / Imphal / Agartala' },
  '80': { state: 'Bihar', defaultCity: 'Patna' },
  '81': { state: 'Bihar', defaultCity: 'Bhagalpur' },
  '82': { state: 'Bihar', defaultCity: 'Gaya' },
  '83': { state: 'Jharkhand', defaultCity: 'Ranchi / Jamshedpur' },
  '84': { state: 'Bihar', defaultCity: 'Muzaffarpur / Motihari' },
  '85': { state: 'Bihar', defaultCity: 'Purnia' },
};

export function lookupPinCode(pin: string): PinCodeInfo | null {
  const cleanPin = pin.trim().replace(/\D/g, '');
  if (cleanPin.length !== 6) return null;

  // Exact match first
  if (PIN_CODE_DATABASE[cleanPin]) {
    return PIN_CODE_DATABASE[cleanPin];
  }

  // Prefix match
  const prefix = cleanPin.substring(0, 2);
  const matchedCircle = POSTAL_CIRCLE_MAP[prefix];
  if (matchedCircle) {
    return {
      district: matchedCircle.state,
      state: matchedCircle.state,
      city: matchedCircle.defaultCity,
    };
  }

  return null;
}

