import { useState, useEffect } from "react";
import { Menu, Globe, ChevronDown, BarChart, Table, Eye, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "./sidebar";
import { FileUploadCard } from "./file-upload-card";
import { AddressMappingsTable } from "./address-mappings-table";
import { JsonPreviewModal } from "./json-preview-modal";
import type { AddressMapping, ConfigFile } from "@shared/schema";

export function PlcConfigBuilder() {
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUploadCard, setShowUploadCard] = useState(true);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  
  // Configuration state
  const [configFileName, setConfigFileName] = useState("plc_config.json");
  const [configDescription, setConfigDescription] = useState("");
  const [plcNo, setPlcNo] = useState<number | string>(1);
  const [plcName, setPlcName] = useState("PLC1");
  const [plcIp, setPlcIp] = useState("192.168.2.2");
  const [opcuaUrl, setOpcuaUrl] = useState("opc.tcp://192.168.1.20:4840");
  const [addressMappings, setAddressMappings] = useState<AddressMapping[]>([
    { plc_reg_add: "2.01", data_type: "int16", opcua_reg_add: "BOOL_VAR01" },
    { plc_reg_add: "C0001", data_type: "int16", opcua_reg_add: "INT_VAR01" }
  ]);
  
  // Memory area selections state
  const [selectedMemoryAreas, setSelectedMemoryAreas] = useState<Set<string>>(
    new Set(['I/O', 'A', 'C', 'D', 'E', 'T', 'H'])
  );

  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(now.toLocaleDateString('en-US', options));
  }, []);

  const generateJson = (): string => {
    const config: ConfigFile = {
      plcs: [{
        plc_name: plcName,
        plc_ip: plcIp,
        opcua_url: opcuaUrl,
        address_mappings: addressMappings
      }]
    };
    return JSON.stringify(config, null, 2);
  };

  const handleFileProcessed = (mappings: AddressMapping[]) => {
    setAddressMappings(mappings);
    // Keep the upload card visible after importing
  };

  const handleExportJson = () => {
    const json = generateJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = configFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "JSON Exported",
      description: `Configuration exported as ${configFileName}`,
    });
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ja' : 'en');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Analysis functions for overview
  const analyzeAddressMappings = () => {
    const memoryAreaCounts = new Map<string, number>();
    const datatypeCounts = new Map<string, number>();
    const otherDatatypes = new Set<string>();
    
    const standardDatatypes = new Set(['int16', 'int32', 'float32', 'bool', 'string']);
    
    addressMappings.forEach(mapping => {
      // Extract memory area from register address
      const firstChar = mapping.plc_reg_add.charAt(0).toUpperCase();
      
      // Group I and O into I/O
      if (firstChar === 'I' || firstChar === 'O') {
        memoryAreaCounts.set('I/O', (memoryAreaCounts.get('I/O') || 0) + 1);
      } else if (['A', 'C', 'D', 'E', 'T', 'H'].includes(firstChar)) {
        memoryAreaCounts.set(firstChar, (memoryAreaCounts.get(firstChar) || 0) + 1);
      }
      
      // Count datatypes
      if (standardDatatypes.has(mapping.data_type)) {
        datatypeCounts.set(mapping.data_type, (datatypeCounts.get(mapping.data_type) || 0) + 1);
      } else {
        otherDatatypes.add(mapping.data_type);
      }
    });
    
    return { memoryAreaCounts, datatypeCounts, otherDatatypes };
  };

  const toggleMemoryArea = (area: string) => {
    const newSelected = new Set(selectedMemoryAreas);
    if (newSelected.has(area)) {
      newSelected.delete(area);
    } else {
      newSelected.add(area);
    }
    setSelectedMemoryAreas(newSelected);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="container-plc-config">
      {/* Navigation Bar */}
      <nav className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Menu Button and Sessions */}
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="p-2"
                data-testid="button-menu-toggle"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="hidden md:flex items-center space-x-2">
                <span className="text-sm font-medium text-muted-foreground" data-testid="text-session">
                  {t('sessionText')} {plcName}
                </span>
              </div>
            </div>
            
            {/* Center: Title and Date */}
            <div className="flex flex-col items-center">
              <h1 className="text-lg font-semibold text-foreground" data-testid="text-main-title">
                {t('mainTitle')}
              </h1>
              <span className="text-xs text-muted-foreground" data-testid="text-current-date">
                {currentDate}
              </span>
            </div>
            
            {/* Right: Language Toggle */}
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleLanguage}
                className="flex items-center space-x-2"
                data-testid="button-language-toggle"
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">{t('currentLang')}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onToggle={toggleSidebar} plcName={plcName} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* File Configuration Section */}
        <Card className="mb-6" data-testid="card-file-config">
          <CardHeader>
            <CardTitle data-testid="text-config-title">{t('configTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="configFileName" data-testid="label-file-name">
                  {t('fileNameLabel')}
                </Label>
                <Input
                  id="configFileName"
                  value={configFileName}
                  onChange={(e) => setConfigFileName(e.target.value)}
                  className="mt-1"
                  data-testid="input-file-name"
                />
              </div>
              <div>
                <Label htmlFor="configDescription" data-testid="label-description">
                  {t('descriptionLabel')}
                </Label>
                <Input
                  id="configDescription"
                  value={configDescription}
                  onChange={(e) => setConfigDescription(e.target.value)}
                  placeholder={t('enterDescription')}
                  className="mt-1"
                  data-testid="input-description"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File Upload Card */}
        {showUploadCard && (
          <FileUploadCard 
            onFileProcessed={handleFileProcessed}
            plcNo={typeof plcNo === 'number' ? plcNo : parseInt(plcNo.toString()) || 1}
          />
        )}

        {/* PLC Configuration Section */}
        <Card className="mb-6" data-testid="card-plc-config">
          <CardHeader>
            <CardTitle data-testid="text-plc-config-title">{t('plcConfigTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="plcNo" data-testid="label-plc-no">
                  {t('plcNoLabel')}
                </Label>
                <Input
                  id="plcNo"
                  type="number"
                  min="1"
                  value={plcNo}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setPlcNo('');
                    } else {
                      const numValue = parseInt(value);
                      if (!isNaN(numValue) && numValue > 0) {
                        setPlcNo(numValue);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') {
                      setPlcNo(1);
                    }
                  }}
                  className={`mt-1 transition-all duration-200 ${
                    plcNo === 1 || plcNo === '1' ? 'text-muted-foreground font-light' : 'text-foreground font-semibold'
                  }`}
                  data-testid="input-plc-no"
                />
              </div>
              <div>
                <Label htmlFor="plcName" data-testid="label-plc-name">
                  {t('plcNameLabel')}
                </Label>
                <Input
                  id="plcName"
                  value={plcName}
                  onChange={(e) => setPlcName(e.target.value)}
                  className={`mt-1 transition-all duration-200 ${
                    plcName === 'PLC1' ? 'text-muted-foreground font-light' : 'text-foreground font-semibold'
                  }`}
                  data-testid="input-plc-name"
                />
              </div>
              <div>
                <Label htmlFor="plcIp" data-testid="label-plc-ip">
                  {t('plcIpLabel')}
                </Label>
                <Input
                  id="plcIp"
                  value={plcIp}
                  onChange={(e) => setPlcIp(e.target.value)}
                  className={`mt-1 transition-all duration-200 ${
                    plcIp === '192.168.2.2' ? 'text-muted-foreground font-light' : 'text-foreground font-semibold'
                  }`}
                  data-testid="input-plc-ip"
                />
              </div>
              <div>
                <Label htmlFor="opcuaUrl" data-testid="label-opcua-url">
                  {t('opcuaUrlLabel')}
                </Label>
                <Input
                  id="opcuaUrl"
                  value={opcuaUrl}
                  onChange={(e) => setOpcuaUrl(e.target.value)}
                  className={`mt-1 transition-all duration-200 ${
                    opcuaUrl === 'opc.tcp://192.168.1.20:4840' ? 'text-muted-foreground font-light' : 'text-foreground font-semibold'
                  }`}
                  data-testid="input-opcua-url"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expandable Sections */}
        <div className="space-y-4">
          {/* Overview Details Section */}
          <Card data-testid="card-overview">
            <Collapsible open={overviewExpanded} onOpenChange={setOverviewExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full p-4 justify-between text-left hover:bg-muted"
                  data-testid="button-overview-toggle"
                >
                  <div className="flex items-center space-x-2">
                    <BarChart className="w-5 h-5 text-primary" />
                    <span className="text-lg font-medium text-foreground">
                      {t('overviewTitle')}
                    </span>
                  </div>
                  <ChevronDown 
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      overviewExpanded ? 'rotate-180' : ''
                    }`} 
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 border-t border-border" data-testid="content-overview">
                  {(() => {
                    const { memoryAreaCounts, datatypeCounts, otherDatatypes } = analyzeAddressMappings();
                    const standardMemoryAreas = ['I/O', 'A', 'C', 'D', 'E', 'T', 'H'];
                    
                    return (
                      <div className="space-y-6">
                        {/* Total Variables Found */}
                        <div className="bg-muted p-4 rounded-lg" data-testid="stat-total-variables">
                          <div className="text-2xl font-bold text-primary">{addressMappings.length}</div>
                          <div className="text-sm text-muted-foreground">{t('totalVariables')}</div>
                        </div>

                        {/* Memory Areas */}
                        <div className="space-y-3" data-testid="section-memory-areas">
                          <h3 className="text-lg font-semibold text-foreground">{t('memoryAreas')}</h3>
                          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                            {standardMemoryAreas.map(area => {
                              const count = memoryAreaCounts.get(area) || 0;
                              return (
                                <div key={area} className="flex items-center justify-between p-3 rounded border bg-muted">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`memory-${area}`}
                                      checked={selectedMemoryAreas.has(area)}
                                      onChange={() => toggleMemoryArea(area)}
                                      className="w-4 h-4"
                                      data-testid={`checkbox-memory-${area}`}
                                    />
                                    <label htmlFor={`memory-${area}`} className="text-sm font-medium cursor-pointer">
                                      {area}
                                    </label>
                                  </div>
                                  <span className="text-sm font-bold text-primary">
                                    {count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Datatypes Found */}
                        <div className="space-y-3" data-testid="section-datatypes">
                          <h3 className="text-lg font-semibold text-foreground">{t('datatypesFound')}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {Array.from(datatypeCounts.entries()).map(([datatype, count]) => (
                              <div key={datatype} className="bg-muted p-3 rounded-lg text-center">
                                <div className="text-lg font-bold text-primary">{count}</div>
                                <div className="text-xs text-muted-foreground uppercase">{datatype}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Other Datatypes */}
                        {otherDatatypes.size > 0 && (
                          <div className="space-y-3 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg" data-testid="section-other-datatypes">
                            <h3 className="text-lg font-semibold text-foreground">{t('otherDatatypes')}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                              {Array.from(otherDatatypes).map(datatype => (
                                <div key={datatype} className="bg-muted p-3 rounded-lg text-center">
                                  <div className="text-lg font-bold text-amber-600">?</div>
                                  <div className="text-xs text-muted-foreground uppercase">{datatype}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* PLC Register Details Section */}
          <Card data-testid="card-details">
            <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full p-4 justify-between text-left hover:bg-muted"
                  data-testid="button-details-toggle"
                >
                  <div className="flex items-center space-x-2">
                    <Table className="w-5 h-5 text-primary" />
                    <span className="text-lg font-medium text-foreground">
                      {t('detailsTitle')}
                    </span>
                  </div>
                  <ChevronDown 
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      detailsExpanded ? 'rotate-180' : ''
                    }`} 
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 border-t border-border" data-testid="content-details">
                  <div className="mb-4 flex justify-end space-x-2">
                    <Button
                      variant="secondary"
                      onClick={() => setShowJsonModal(true)}
                      className="flex items-center space-x-2"
                      data-testid="button-preview-json"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{t('previewText')}</span>
                    </Button>
                    <Button
                      onClick={handleExportJson}
                      className="flex items-center space-x-2"
                      data-testid="button-export-json"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t('exportText')}</span>
                    </Button>
                  </div>
                  
                  <AddressMappingsTable 
                    mappings={addressMappings}
                    onMappingsChange={setAddressMappings}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      </div>

      {/* JSON Preview Modal */}
      <JsonPreviewModal 
        isOpen={showJsonModal}
        onClose={() => setShowJsonModal(false)}
        jsonContent={generateJson()}
      />
    </div>
  );
}
