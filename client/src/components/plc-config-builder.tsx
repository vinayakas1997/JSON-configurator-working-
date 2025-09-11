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
import type { ParseResult } from "@/lib/plc-parser";
import { generateOpcuaName } from "@/lib/plc-parser";

export function PlcConfigBuilder() {
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUploadCard, setShowUploadCard] = useState(true);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  
  // Configuration state
  const [configFileName, setConfigFileName] = useState("plc_config");
  const [configDescription, setConfigDescription] = useState("");
  const [plcNo, setPlcNo] = useState<number | string>(1);
  const [plcName, setPlcName] = useState("PLC1");
  const [plcIp, setPlcIp] = useState("192.168.2.2");
  const [opcuaUrl, setOpcuaUrl] = useState("opc.tcp://192.168.1.20:4840");
  const [addressMappings, setAddressMappings] = useState<AddressMapping[]>([
    { plc_reg_add: "2.01", data_type: "BOOL", opcua_reg_add: "BOOL_VAR01" },
    { plc_reg_add: "C0001", data_type: "WORD", opcua_reg_add: "INT_VAR01" }
  ]);
  
  // Memory area selections state
  const [selectedMemoryAreas, setSelectedMemoryAreas] = useState<Set<string>>(
    new Set(['I/O', 'A', 'C', 'D', 'E', 'T', 'H'])
  );
  const [selectedRegisters, setSelectedRegisters] = useState<Set<number>>(new Set());
  
  // File parsing results state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

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

  // Regenerate OPC UA names when PLC number changes
  useEffect(() => {
    const plcNumber = typeof plcNo === 'number' ? plcNo : parseInt(plcNo.toString()) || 1;
    const updatedMappings = addressMappings.map(mapping => {
      const baseAddr = mapping.plc_reg_add.split('.')[0];
      let newOpcuaName: string;
      
      // Handle different mapping types correctly
      if (mapping.opcua_reg_add.endsWith('_BC')) {
        // This is a grouped boolean channel - use BOOL with isBooleanChannel=true
        newOpcuaName = generateOpcuaName(baseAddr, 'BOOL', undefined, true, plcNumber);
      } else if (mapping.data_type === 'CHANNEL' || mapping.data_type === 'modified channel') {
        // This is a true CHANNEL mapping or modified channel - use CHANNEL
        newOpcuaName = generateOpcuaName(baseAddr, 'CHANNEL', undefined, false, plcNumber);
      } else if (mapping.data_type === 'BOOL' && mapping.plc_reg_add.includes('.')) {
        // Individual BOOL with bit position
        const bitPosition = mapping.plc_reg_add.split('.')[1];
        newOpcuaName = generateOpcuaName(baseAddr, 'BOOL', bitPosition, false, plcNumber);
      } else {
        // Other data types
        newOpcuaName = generateOpcuaName(baseAddr, mapping.data_type, undefined, false, plcNumber);
      }
      
      return {
        ...mapping,
        opcua_reg_add: newOpcuaName
      };
    });
    
    setAddressMappings(updatedMappings);
  }, [plcNo]); // Only depend on plcNo to avoid infinite loops

  // Helper function to get memory area from mapping  
  const getMemoryAreaFromMapping = (mapping: AddressMapping): string => {
    const firstChar = mapping.plc_reg_add.charAt(0).toUpperCase();
    // Group I and O into I/O, and numeric addresses as I/O
    if (firstChar === 'I' || firstChar === 'O' || /^\d/.test(mapping.plc_reg_add)) {
      return 'I/O';
    }
    return firstChar;
  };

  // Helper function to remove duplicate entries based on OPC UA register name
  const dedupeByOpcuaName = (mappings: any[], plcName: string): any[] => {
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    
    for (const mapping of mappings) {
      const key = `${plcName}|${mapping.opcua_reg_add}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(mapping);
      }
    }
    
    return deduplicated;
  };

  const generateJson = (): string => {
    // Filter and transform address mappings based on selections
    const filteredMappings = addressMappings
      .map((mapping, index) => ({ mapping, index }))
      .filter(({ mapping, index }) => {
        // Filter by memory area selection
        const memoryArea = getMemoryAreaFromMapping(mapping);
        if (!selectedMemoryAreas.has(memoryArea)) {
          return false;
        }
        
        // Filter by individual register selection (if no registers selected, select all)
        if (selectedRegisters.size > 0 && !selectedRegisters.has(index)) {
          return false;
        }
        
        return true;
      })
      .map(({ mapping }) => {
        const memoryArea = getMemoryAreaFromMapping(mapping);
        const result: any = {
          plc_reg_add: mapping.plc_reg_add,
          data_type: mapping.data_type === "modified channel" ? "channel" : mapping.data_type.toLowerCase(),
          opcua_reg_add: mapping.opcua_reg_add,
          description: (mapping as any).description || '',
          Memory_Area: memoryArea
        };
        
        // Include metadata if it exists (for boolean channels)
        if ((mapping as any).metadata) {
          result.metadata = (mapping as any).metadata;
        }
        
        return result;
      });

    // Remove duplicates based on OPC UA register name (keep first occurrence)
    const deduplicatedMappings = dedupeByOpcuaName(filteredMappings, plcName);

    const config: ConfigFile = {
      plcs: [{
        plc_name: plcName,
        plc_ip: plcIp,
        opcua_url: opcuaUrl,
        address_mappings: deduplicatedMappings as any
      }]
    };
    return JSON.stringify(config, null, 2);
  };

  const handleFileProcessed = (mappings: AddressMapping[], result?: ParseResult) => {
    setAddressMappings(mappings);
    if (result) {
      setParseResult(result);
    }
    // Keep the upload card visible after importing
  };

  const handleExportJson = () => {
    const json = generateJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${configFileName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "JSON Exported",
      description: `Configuration exported as ${configFileName}.json`,
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
    const memoryAreaAddresses = new Map<string, string[]>();
    const datatypeCounts = new Map<string, number>();
    const datatypeAddresses = new Map<string, string[]>();
    const otherDatatypes = new Set<string>();
    
    // Get boolean channel addresses from parse result
    const booleanChannelAddresses = parseResult?.booleanChannelAddresses || [];
    
    const standardDatatypes = new Set(['int16', 'int32', 'float32', 'bool', 'string', 'CHANNEL', 'BOOL', 'WORD', 'UDINT', 'DWORD', 'INT', 'REAL', 'LREAL']);
    
    addressMappings.forEach(mapping => {
      // Extract memory area from register address
      const firstChar = mapping.plc_reg_add.charAt(0).toUpperCase();
      
      let memoryArea: string;
      
      // Group I and O into I/O, and numeric addresses (starting with digit) as I/O
      if (firstChar === 'I' || firstChar === 'O' || /^\d/.test(mapping.plc_reg_add)) {
        memoryArea = 'I/O';
      } else if (['A', 'C', 'D', 'E', 'T', 'H'].includes(firstChar)) {
        memoryArea = firstChar;
      } else {
        return; // Skip unsupported memory areas
      }
      
      // Count and store addresses for each memory area
      memoryAreaCounts.set(memoryArea, (memoryAreaCounts.get(memoryArea) || 0) + 1);
      if (!memoryAreaAddresses.has(memoryArea)) {
        memoryAreaAddresses.set(memoryArea, []);
      }
      memoryAreaAddresses.get(memoryArea)!.push(mapping.plc_reg_add);
      
      // Count and store addresses for each datatype
      if (standardDatatypes.has(mapping.data_type)) {
        datatypeCounts.set(mapping.data_type, (datatypeCounts.get(mapping.data_type) || 0) + 1);
        if (!datatypeAddresses.has(mapping.data_type)) {
          datatypeAddresses.set(mapping.data_type, []);
        }
        datatypeAddresses.get(mapping.data_type)!.push(mapping.plc_reg_add);
      } else {
        otherDatatypes.add(mapping.data_type);
      }
    });
    
    return { memoryAreaCounts, memoryAreaAddresses, datatypeCounts, datatypeAddresses, otherDatatypes, booleanChannelAddresses };
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
                <div className="flex items-center mt-1">
                  <Input
                    id="configFileName"
                    value={configFileName}
                    onChange={(e) => setConfigFileName(e.target.value)}
                    className="rounded-r-none"
                    data-testid="input-file-name"
                  />
                  <span className="inline-flex items-center px-3 py-2 border border-l-0 border-input bg-muted text-muted-foreground text-sm rounded-r-md">
                    .json
                  </span>
                </div>
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
            onFileProcessed={(mappings, result) => handleFileProcessed(mappings, result)}
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
                    const { memoryAreaCounts, memoryAreaAddresses, datatypeCounts, datatypeAddresses, otherDatatypes, booleanChannelAddresses } = analyzeAddressMappings();
                    const standardMemoryAreas = ['I/O', 'A', 'C', 'D', 'E', 'T', 'H'];
                    
                    return (
                      <div className="space-y-6">
                        {/* Total Variables Imported and Skipped Records */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-muted p-4 rounded-lg" data-testid="stat-total-variables">
                            <div className="text-2xl font-bold text-primary">{addressMappings.length}</div>
                            <div className="text-sm text-muted-foreground">{t('totalVariables')}</div>
                          </div>
                          
                          {/* Show skipped records count from file upload results if available */}
                          {parseResult && parseResult.stats.skippedRecords > 0 && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors" data-testid="stat-skipped-records">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-2xl font-bold text-orange-600">{parseResult.stats.skippedRecords}</div>
                                      <div className="text-sm text-muted-foreground">Skipped Records</div>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded border-l-4 border-orange-500">
                                  <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">Skipped Addresses:</h4>
                                  <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {parseResult.skippedAddresses.map((skipped, index) => (
                                      <div key={index} className="text-xs bg-white dark:bg-gray-800 p-2 rounded border">
                                        <div className="font-mono text-orange-700 dark:text-orange-300">{skipped.address}</div>
                                        <div className="text-gray-600 dark:text-gray-400">{skipped.data_type} - {skipped.reason}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>

                        {/* Memory Areas */}
                        <div className="space-y-3" data-testid="section-memory-areas">
                          <h3 className="text-lg font-semibold text-foreground">{t('memoryAreas')}</h3>
                          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                            {standardMemoryAreas.map(area => {
                              const count = memoryAreaCounts.get(area) || 0;
                              const addresses = memoryAreaAddresses.get(area) || [];
                              return (
                                <Collapsible key={area}>
                                  <div className="flex flex-col">
                                    <div className="flex items-center justify-between p-3 rounded border bg-muted">
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
                                      <div className="flex items-center space-x-1">
                                        <span className="text-sm font-bold text-primary">{count}</span>
                                        {count > 0 && (
                                          <CollapsibleTrigger asChild>
                                            <button className="p-1 hover:bg-background rounded" data-testid={`expand-memory-${area}`}>
                                              <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                            </button>
                                          </CollapsibleTrigger>
                                        )}
                                      </div>
                                    </div>
                                    {count > 0 && (
                                      <CollapsibleContent>
                                        <div className="mt-1 p-2 bg-muted/50 rounded border-l-2 border-primary/30">
                                          <div className="max-h-32 overflow-y-auto">
                                            <div className="space-y-1">
                                              {addresses.map((address, index) => (
                                                <div key={index} className="text-xs font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                                                  {address}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    )}
                                  </div>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </div>

                        {/* Datatypes Found */}
                        <div className="space-y-3" data-testid="section-datatypes">
                          <h3 className="text-lg font-semibold text-foreground">{t('datatypesFound')}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {Array.from(datatypeCounts.entries()).map(([datatype, count]) => {
                              const addresses = datatypeAddresses.get(datatype) || [];
                              return (
                                <Collapsible key={datatype}>
                                  <div className="flex flex-col">
                                    <div className="bg-muted p-3 rounded-lg">
                                      <div className="flex items-center justify-between">
                                        <div className="text-center flex-1">
                                          <div className="text-lg font-bold text-primary">{count}</div>
                                          <div className="text-xs text-muted-foreground uppercase">{datatype}</div>
                                        </div>
                                        {count > 0 && (
                                          <CollapsibleTrigger asChild>
                                            <button className="p-1 hover:bg-background rounded ml-2" data-testid={`expand-datatype-${datatype}`}>
                                              <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                            </button>
                                          </CollapsibleTrigger>
                                        )}
                                      </div>
                                    </div>
                                    {count > 0 && (
                                      <CollapsibleContent>
                                        <div className="mt-1 p-2 bg-muted/50 rounded border-l-2 border-primary/30">
                                          <div className="max-h-32 overflow-y-auto">
                                            <div className="space-y-1">
                                              {addresses.map((address, index) => (
                                                <div key={index} className="text-xs font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                                                  {address}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    )}
                                  </div>
                                </Collapsible>
                              );
                            })}
                            
                            {/* BOOL CHANNEL datatype with orange color */}
                            {booleanChannelAddresses.length > 0 && (
                              <Collapsible key="BOOL CHANNEL">
                                <div className="flex flex-col">
                                  <div className="bg-muted p-3 rounded-lg">
                                    <div className="flex items-center justify-between">
                                      <div className="text-center flex-1">
                                        <div className="text-lg font-bold text-primary">{booleanChannelAddresses.length}</div>
                                        <div className="text-xs text-orange-600 dark:text-orange-400 uppercase font-medium">{t('boolChannel')}</div>
                                      </div>
                                      <CollapsibleTrigger asChild>
                                        <button className="p-1 hover:bg-background rounded ml-2" data-testid="expand-datatype-bool-channel">
                                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                        </button>
                                      </CollapsibleTrigger>
                                    </div>
                                  </div>
                                  <CollapsibleContent>
                                    <div className="mt-1 p-2 bg-muted/50 rounded border-l-2 border-orange-400/30">
                                      <div className="max-h-32 overflow-y-auto">
                                        <div className="space-y-1">
                                          {booleanChannelAddresses.map((address: string, index: number) => (
                                            <div key={index} className="text-xs font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                                              {address}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            )}
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
                    selectedMemoryAreas={selectedMemoryAreas}
                    onSelectedRegistersChange={setSelectedRegisters}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* JSON buttons outside the card */}
          <div className="mt-4 flex justify-center space-x-4">
            <Button
              variant="secondary"
              onClick={() => setShowJsonModal(true)}
              className="flex items-center space-x-2"
              data-testid="button-preview-json-outside"
            >
              <Eye className="w-4 h-4" />
              <span>{t('previewText')}</span>
            </Button>
            <Button
              onClick={handleExportJson}
              className="flex items-center space-x-2"
              data-testid="button-export-json-outside"
            >
              <Download className="w-4 h-4" />
              <span>{t('exportText')}</span>
            </Button>
          </div>
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
