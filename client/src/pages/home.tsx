import { PlcConfigBuilder } from "@/components/plc-config-builder";
import { LanguageProvider } from "@/hooks/use-language";

export default function Home() {
  return (
    <LanguageProvider>
      <PlcConfigBuilder />
    </LanguageProvider>
  );
}
