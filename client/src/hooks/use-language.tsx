import { useState, useEffect, createContext, useContext } from "react";
import { translations, type TranslationKey } from "@/lib/translations";

interface LanguageContextType {
  language: 'en' | 'ja';
  setLanguage: (lang: 'en' | 'ja') => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<'en' | 'ja'>('en');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('plc-config-language') as 'en' | 'ja';
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ja')) {
      setLanguage(savedLanguage);
    }
  }, []);

  const handleSetLanguage = (lang: 'en' | 'ja') => {
    setLanguage(lang);
    localStorage.setItem('plc-config-language', lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
