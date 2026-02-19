import React, { useState } from 'react';
import './MythVsFacts.css';

function MythVsFacts() {
  const [language, setLanguage] = useState('english');

  const mythsData = [
    {
      id: 1,
      myth: 'Only dirty water breeds mosquitoes',
      mythHindi: 'केवल गंदा पानी मच्छर पैदा करता है',
      fact: 'Even clean water in containers can breed mosquitoes if left stagnant for 7+ days',
      factHindi: 'कंटेनरों में साफ पानी भी 7+ दिनों तक स्थिर रहने पर मच्छर पैदा कर सकता है'
    },
    {
      id: 2,
      myth: 'Dengue is spread by night mosquitoes only',
      mythHindi: 'डेंगू केवल रात के मच्छरों से फैलता है',
      fact: 'Aedes mosquitoes bite during day (6 AM to 6 PM) and are most active in early morning and late evening',
      factHindi: 'एडीज मच्छर दिन में (सुबह 6 बजे से शाम 6 बजे तक) काटते हैं और सुबह जल्दी और देर शाम सबसे अधिक सक्रिय होते हैं'
    },
    {
      id: 3,
      myth: 'Dengue fever is always fatal',
      mythHindi: 'डेंगू बुखार हमेशा घातक होता है',
      fact: 'Most dengue patients recover completely with proper treatment and care. Only severe dengue (DHF/DSS) can be fatal',
      factHindi: 'अधिकांश डेंगू रोगी सही उपचार और देखभाल से पूरी तरह ठीक हो जाते हैं। केवल गंभीर डेंगू (DHF/DSS) घातक हो सकता है'
    },
    {
      id: 4,
      myth: 'Repellents and sprays eliminate dengue completely',
      mythHindi: 'रिपेलेंट्स और स्प्रे डेंगू को पूरी तरह खत्म कर देते हैं',
      fact: 'Repellents only protect individuals. Removing breeding sites (source reduction) is the only way to control dengue at community level',
      factHindi: 'रिपेलेंट्स केवल व्यक्तियों की सुरक्षा करते हैं। प्रजनन स्थलों को हटाना (स्रोत कमी) समुदाय स्तर पर डेंगू को नियंत्रित करने का एकमात्र तरीका है'
    },
    {
      id: 5,
      myth: 'Dengue mosquitoes die in winter',
      mythHindi: 'सर्दियों में डेंगू मच्छर मर जाते हैं',
      fact: 'Eggs can survive in cool weather. In tropical regions, dengue can occur year-round',
      factHindi: 'अंडे ठंड के मौसम में जीवित रह सकते हैं। उष्णकटिबंधीय क्षेत्रों में डेंगू साल भर हो सकता है'
    },
    {
      id: 6,
      myth: 'A single mosquito cannot cause dengue infection',
      mythHindi: 'एक ही मच्छर डेंगू संक्रमण नहीं कर सकता',
      fact: 'Just ONE bite from an infected mosquito is enough to cause dengue infection',
      factHindi: 'संक्रमित मच्छर के एक ही काटने से डेंगू संक्रमण हो सकता है'
    },
    {
      id: 7,
      myth: 'Drinking coconut water prevents dengue',
      mythHindi: 'नारियल पानी पीने से डेंगू रोकथाम होती है',
      fact: 'Coconut water provides hydration during dengue recovery but does NOT prevent or cure dengue. Only mosquito control prevents it',
      factHindi: 'नारियल पानी डेंगू के दौरान हाइड्रेशन प्रदान करता है लेकिन डेंगू को रोकता या ठीक नहीं करता। केवल मच्छर नियंत्रण इसे रोकता है'
    },
    {
      id: 8,
      myth: 'All mosquitoes carry dengue virus',
      mythHindi: 'सभी मच्छर डेंगू वायरस ले जाते हैं',
      fact: 'Only Aedes mosquitoes (especially Aedes aegypti) transmit dengue. Other mosquito species do not',
      factHindi: 'केवल एडीज मच्छर (विशेषकर एडीज इजिप्टी) डेंगू प्रसारित करते हैं। अन्य मच्छर प्रजातियां नहीं करती'
    },
    {
      id: 9,
      myth: 'Once you have dengue, you are immune forever',
      mythHindi: 'एक बार डेंगू होने के बाद आप हमेशा के लिए प्रतिरोधी हैं',
      fact: 'You develop immunity to that specific dengue strain (1 of 4), but can catch other strains. Re-infection is more dangerous',
      factHindi: 'आप उस विशेष डेंगू स्ट्रेन (4 में से 1) के लिए प्रतिरोधक्षमता विकसित करते हैं, लेकिन अन्य स्ट्रेन को पकड़ सकते हैं। पुन: संक्रमण अधिक खतरनाक है'
    },
    {
      id: 10,
      myth: 'Flowers and plants attract dengue mosquitoes',
      mythHindi: 'फूल और पौधे डेंगू मच्छरों को आकर्षित करते हैं',
      fact: 'Aedes mosquitoes breed in water, not plants. They are attracted to water containers and stagnant water sources',
      factHindi: 'एडीज मच्छर पानी में प्रजनन करते हैं, पौधों में नहीं। वे पानी के कंटेनर और स्थिर पानी के स्रोतों की ओर आकर्षित होते हैं'
    },
    {
      id: 11,
      myth: 'Dengue is cured by antibiotics',
      mythHindi: 'डेंगू को एंटीबायोटिक्स से ठीक किया जा सकता है',
      fact: 'Dengue is viral. Antibiotics do NOT work. Treatment is supportive (hydration, rest, monitoring)',
      factHindi: 'डेंगू वायरल है। एंटीबायोटिक्स काम नहीं करते। उपचार सहायक है (जलयोजन, आराम, निगरानी)'
    },
    {
      id: 12,
      myth: 'Dengue mosquitoes only breed in large water containers',
      mythHindi: 'डेंगू मच्छर केवल बड़े पानी के कंटेनरों में प्रजनन करते हैं',
      fact: 'They breed in ANY stagnant water: bottle caps, flower pots, old tyres, coconut shells, even a spoon of water',
      factHindi: 'वे किसी भी स्थिर पानी में प्रजनन करते हैं: बोतल के ढक्कन, फूलों के बर्तन, पुरानी टायर, नारियल के छिलके, यहां तक कि एक चम्मच पानी में भी'
    },
    {
      id: 13,
      myth: 'Mosquito nets prevent dengue completely',
      mythHindi: 'मच्छर जाली पूरी तरह डेंगू को रोकती है',
      fact: 'Nets help if you sleep during daytime (when Aedes bites), but are not enough. You need to remove breeding sites too',
      factHindi: 'जाली मदद करती है अगर आप दिन के समय सोते हैं (जब एडीज काटते हैं), लेकिन पर्याप्त नहीं है। आपको प्रजनन स्थलों को भी हटाना होगा'
    },
    {
      id: 14,
      myth: 'Dengue fever symptoms appear immediately after a bite',
      mythHindi: 'डेंगू बुखार के लक्षण काटने के तुरंत बाद दिखाई देते हैं',
      fact: 'Incubation period is 3-7 days. You may feel fine but be spreading virus to others',
      factHindi: 'ऊष्मायन अवधि 3-7 दिन है। आप ठीक महसूस कर सकते हैं लेकिन दूसरों को वायरस फैला रहे हैं'
    },
    {
      id: 15,
      myth: 'Cleaning water tanks every week is not necessary',
      mythHindi: 'पानी की टंकी को हर हफ्ते साफ करना जरूरी नहीं है',
      fact: 'Mosquito eggs hatch in 2-3 days and adults emerge in 7 days. Weekly cleaning breaks the breeding cycle',
      factHindi: 'मच्छर के अंडे 2-3 दिन में निकलते हैं और वयस्क 7 दिन में निकलते हैं। साप्ताहिक सफाई प्रजनन चक्र को तोड़ देती है'
    },
    {
      id: 16,
      myth: 'Eating spicy food boosts immunity against dengue',
      mythHindi: 'मसालेदार भोजन खाने से डेंगू के खिलाफ प्रतिरक्षा बढ़ती है',
      fact: 'No food boosts immunity against dengue. Prevention is only through mosquito control and source reduction',
      factHindi: 'कोई भी भोजन डेंगू के खिलाफ प्रतिरक्षा नहीं बढ़ाता। रोकथाम केवल मच्छर नियंत्रण और स्रोत कमी के माध्यम से है'
    },
    {
      id: 17,
      myth: 'Air conditioning kills dengue mosquitoes',
      mythHindi: 'एयर कंडीशनिंग डेंगू मच्छरों को मार देती है',
      fact: 'AC rooms may reduce mosquito activity but do NOT kill them. Aedes mosquitoes can survive in cool environments and still bite during the day',
      factHindi: 'AC वाले कमरे मच्छरों की गतिविधि कम कर सकते हैं लेकिन उन्हें मारते नहीं। एडीज मच्छर ठंडे वातावरण में जीवित रह सकते हैं और दिन के दौरान भी काट सकते हैं'
    }
  ];

  return (
    <div className="myth-container">
      <div className="myth-card">
        <div className="myth-header">
          <h2>Myth vs Fact: Dengue Prevention</h2>
          <p className="myth-subtitle">Clear the confusion, prevent dengue</p>
          <div className="language-toggle">
            <button
              className={language === 'english' ? 'active' : ''}
              onClick={() => setLanguage('english')}
            >
              English
            </button>
            <button
              className={language === 'hindi' ? 'active' : ''}
              onClick={() => setLanguage('hindi')}
            >
              हिंदी
            </button>
          </div>
        </div>

        <div className="myth-grid">
          {mythsData.map((item) => (
            <div key={item.id} className="myth-fact-box">
              <div className="myth-section">
                <div className="section-header myth-header-style">
                  <span className="section-icon">❌</span>
                  <span className="section-label">
                    {language === 'hindi' ? 'मिथक' : 'MYTH'}
                  </span>
                </div>
                <p className="myth-text">
                  {language === 'hindi' ? item.mythHindi : item.myth}
                </p>
              </div>

              <div className="divider"></div>

              <div className="fact-section">
                <div className="section-header fact-header-style">
                  <span className="section-icon">FACT</span>
                  <span className="section-label">
                    {language === 'hindi' ? 'तथ्य' : 'FACT'}
                  </span>
                </div>
                <p className="fact-text">
                  {language === 'hindi' ? item.factHindi : item.fact}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="myth-footer">
          <p className="source-note">
            💡 {language === 'hindi' 
              ? 'यह जानकारी WHO डेंगू रोकथाम दिशानिर्देशों पर आधारित है' 
              : 'Information based on WHO dengue prevention guidelines'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default MythVsFacts;
