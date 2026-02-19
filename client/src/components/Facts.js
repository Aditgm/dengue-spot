import React, { useState, useEffect, useRef } from 'react';
import './Facts.css';

function Facts() {
  const [language, setLanguage] = useState('english');
  const sectionRef = useRef(null);

  // Intersection Observer for scroll animation
  useEffect(() => {
    const currentSection = sectionRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    if (currentSection) {
      observer.observe(currentSection);
    }

    return () => {
      if (currentSection) {
        observer.unobserve(currentSection);
      }
    };
  }, []);

  const factsData = [
    {
      id: 1,
      title: 'Why Source Reduction Matters',
      titleHindi: 'स्रोत कमी क्यों महत्वपूर्ण है',
      fact: 'Mosquitoes breed in stagnant water. Removing breeding sites is the most effective way to prevent dengue.',
      factHindi: 'मच्छर स्थिर पानी में प्रजनन करते हैं। प्रजनन स्थलों को हटाना डेंगू को रोकने का सबसे प्रभावी तरीका है।'
    },
    {
      id: 2,
      title: 'Aedes Mosquito Lifecycle',
      titleHindi: 'एडीज मच्छर जीवन चक्र',
      fact: 'Eggs hatch in 2-3 days. Larva develops in 5-7 days. Adults emerge in 7 days total. One weekly cleaning breaks the cycle.',
      factHindi: 'अंडे 2-3 दिन में निकलते हैं। लार्वा 5-7 दिन में विकसित होता है। वयस्क कुल 7 दिन में निकलते हैं। एक सप्ताह की सफाई चक्र को तोड़ देती है।'
    },
    {
      id: 3,
      title: 'Standing Water Breeding Sites',
      titleHindi: 'स्थिर पानी के प्रजनन स्थल',
      fact: 'Containers, old tyres, flower pots, coconut shells, water tanks, gutters, and any small object holding water can breed mosquitoes.',
      factHindi: 'कंटेनर, पुरानी टायर, फूलों के बर्तन, नारियल के छिलके, पानी की टंकी, नालियां, और पानी रखने वाली कोई भी छोटी वस्तु मच्छर पैदा कर सकती है।'
    },
    {
      id: 4,
      title: 'Prevention Through Cleanliness',
      titleHindi: 'सफाई के माध्यम से रोकथाम',
      fact: 'Empty containers weekly. Cover water tanks properly. Clean gutters and drains. Remove old items that collect water.',
      factHindi: 'साप्ताहिक रूप से कंटेनर खाली करें। पानी की टंकियों को ठीक से ढकें। नालियां और ड्रेन साफ करें। पानी जमा करने वाली पुरानी चीजें हटाएं।'
    },
    {
      id: 5,
      title: 'WHO Recommendation',
      titleHindi: 'विश्व स्वास्थ्य संगठन की सिफारिश',
      fact: 'The World Health Organization (WHO) states that source reduction is the primary dengue control strategy globally.',
      factHindi: 'विश्व स्वास्थ्य संगठन (WHO) कहता है कि स्रोत कमी विश्व स्तर पर प्राथमिक डेंगू नियंत्रण रणनीति है।'
    },
    {
      id: 6,
      title: 'Community vs Individual Action',
      titleHindi: 'सामुदायिक बनाम व्यक्तिगत कार्रवाई',
      fact: 'While sprays protect individuals, community-wide source reduction eliminates breeding sites and protects everyone.',
      factHindi: 'जबकि स्प्रे व्यक्तियों की सुरक्षा करते हैं, सामुदायिक स्तर की स्रोत कमी प्रजनन स्थलों को समाप्त करती है और सभी की रक्षा करती है।'
    },
    {
      id: 7,
      title: 'Water Tank Covers',
      titleHindi: 'पानी की टंकी के कवर',
      fact: 'Using tight-fitting covers on water tanks prevents mosquitoes from laying eggs and is the easiest prevention method.',
      factHindi: 'पानी की टंकियों पर तंग कवर लगाने से मच्छर अंडे देने से रोके जाते हैं और यह सबसे आसान रोकथाम विधि है।'
    },
    {
      id: 8,
      title: 'Mosquito Breeding in Nature',
      titleHindi: 'प्रकृति में मच्छर प्रजनन',
      fact: 'Natural water sources like tree holes, bamboo stems, and leaf axils also breed mosquitoes if they collect water.',
      factHindi: 'पेड़ों के छेद, बांस के तने, और पत्तियों की कक्षें जैसे प्राकृतिक जल स्रोत भी मच्छर पैदा कर सकते हैं अगर वे पानी जमा करते हैं।'
    },
    {
      id: 9,
      title: 'Best Time for Cleaning',
      titleHindi: 'सफाई का सबसे अच्छा समय',
      fact: 'Clean water containers at the beginning of the week to prevent eggs laid late week from developing.',
      factHindi: 'सप्ताह की शुरुआत में पानी के कंटेनर साफ करें ताकि देर से लगाए गए अंडे विकसित न हों।'
    },
    {
      id: 10,
      title: 'Impact of Clean Water Myth',
      titleHindi: 'स्वच्छ पानी के मिथक का प्रभाव',
      fact: 'Even boiled or filtered water can breed mosquitoes if left stagnant. The stagnation is the problem, not water quality.',
      factHindi: 'उबले हुए या फ़िल्टर किए गए पानी भी मच्छर पैदा कर सकते हैं अगर स्थिर रहें। समस्या स्थिरता है, जल की गुणवत्ता नहीं।'
    },
    {
      id: 11,
      title: 'Seasonal Dengue Increase',
      titleHindi: 'मौसमी डेंगू वृद्धि',
      fact: 'Dengue cases spike during monsoon when water accumulation increases. Extra cleaning during rainy season is crucial.',
      factHindi: 'मानसून के दौरान डेंगू के मामले बढ़ते हैं जब पानी की जमाव बढ़ता है। बरसात के मौसम में अतिरिक्त सफाई महत्वपूर्ण है।'
    },
    {
      id: 12,
      title: 'Hygiene vs Source Reduction',
      titleHindi: 'स्वच्छता बनाम स्रोत कमी',
      fact: 'While hygiene helps, source reduction (removing water containers) is 100 times more effective than any other method.',
      factHindi: 'हालांकि स्वच्छता मदद करती है, स्रोत कमी (पानी के कंटेनर हटाना) किसी भी अन्य विधि से 100 गुना अधिक प्रभावी है।'
    },
    {
      id: 13,
      title: 'Household Checklist Items',
      titleHindi: 'घरेलू चेकलिस्ट आइटम',
      fact: 'Check and clean: flower pots, plant saucers, bird baths, coolers, AC drains, buckets, and outdoor tires weekly.',
      factHindi: 'साप्ताहिक रूप से जांचें और साफ करें: फूलों के बर्तन, पौधे की तश्तरियां, पक्षी स्नान, कूलर, AC ड्रेन, बाल्टियां, और बाहरी टायर।'
    },
    {
      id: 14,
      title: 'Cost-Effective Solution',
      titleHindi: 'लागत प्रभावी समाधान',
      fact: 'Source reduction costs almost nothing. Just water, soap, and effort. No expensive chemicals or equipment needed.',
      factHindi: 'स्रोत कमी की कोई लागत नहीं है। केवल पानी, साबुन, और प्रयास चाहिए। महंगे रसायनों या उपकरण की आवश्यकता नहीं है।'
    },
    {
      id: 15,
      title: 'Zero Resistance Development',
      titleHindi: 'शून्य प्रतिरोध विकास',
      fact: 'Unlike chemical sprays where mosquitoes develop resistance, source reduction has NO resistance. It always works.',
      factHindi: 'रासायनिक स्प्रे के विपरीत जहां मच्छर प्रतिरोध विकसित करते हैं, स्रोत कमी का कोई प्रतिरोध नहीं है। यह हमेशा काम करता है।'
    },
    {
      id: 16,
      title: 'Government Guidelines',
      titleHindi: 'सरकारी दिशानिर्देश',
      fact: 'Most countries recommend source reduction as the first line of defense against dengue before any other intervention.',
      factHindi: 'अधिकांश देश किसी भी अन्य हस्तक्षेप से पहले डेंगू के खिलाफ प्रथम रक्षा लाइन के रूप में स्रोत कमी की सिफारिश करते हैं।'
    },
    {
      id: 17,
      title: 'Dry Day Practice',
      titleHindi: 'सूखा दिन अभ्यास',
      fact: 'Pick one day each week as "Dry Day" — empty, scrub, and dry every water-holding container in and around your home. This single habit can reduce mosquito breeding by up to 80%.',
      factHindi: 'हर सप्ताह एक दिन को "ड्राई डे" के रूप में चुनें — अपने घर के अंदर और आसपास हर पानी रखने वाले कंटेनर को खाली करें, रगड़ें और सुखाएं। यह एक आदत मच्छर प्रजनन को 80% तक कम कर सकती है।'
    }
  ];

  return (
    <div className="facts-container fade-in-section" ref={sectionRef}>
      <div className="facts-card">
        <div className="facts-header">
          <h2>Dengue Prevention Facts: Source Reduction</h2>
          <p className="facts-subtitle">Everything you need to know about preventing dengue</p>
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

        <div className="facts-grid">
          {factsData.map((item, index) => (
            <div key={item.id} className="fact-box" data-num={index + 1}>
              <div className="fact-content">
                <h3 className="fact-title">
                  {language === 'hindi' ? item.titleHindi : item.title}
                </h3>
                <p className="fact-text">
                  {language === 'hindi' ? item.factHindi : item.fact}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="facts-footer">
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

export default Facts;
