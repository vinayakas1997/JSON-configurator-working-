import { useState, useEffect, Fragment } from "react";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/hooks/use-language";
import type { AddressMapping } from "@shared/schema";

interface AddressMappingsTableProps {
  mappings: AddressMapping[];
  onMappingsChange: (mappings: AddressMapping[]) => void;
}

// 16-bit grid component for boolean channel visualization
function BooleanChannelGrid({ 
  plcAddress, 
  selectedBits = [], 
  onBitToggle 
}: { 
  plcAddress: string; 
  selectedBits?: number[]; 
  onBitToggle?: (bit: number) => void; 
}) {
  // Extract base address and determine which bits are used
  const baseAddress = plcAddress.split('.')[0];
  const usedBits = selectedBits;

  return (
    <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded border-l-4 border-green-500">
      <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
        16-bit Channel Visualization - Base: {baseAddress}
      </h4>
      <div className="space-y-1">
        {/* Top row: bits 15-8 */}
        <div className="flex space-x-1">
          <span className="text-xs font-mono text-muted-foreground w-8">15</span>
          {Array.from({ length: 8 }, (_, i) => {
            const bitIndex = 15 - i;
            const isUsed = usedBits.includes(bitIndex);
            return (
              <button
                key={bitIndex}
                onClick={() => onBitToggle?.(bitIndex)}
                className={`w-6 h-6 text-xs font-mono border rounded ${
                  isUsed 
                    ? 'bg-green-500 text-white border-green-600' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                data-testid={`bit-${baseAddress}-${bitIndex}`}
              >
                {bitIndex}
              </button>
            );
          })}
          <span className="text-xs font-mono text-muted-foreground w-8">8</span>
        </div>
        {/* Bottom row: bits 7-0 */}
        <div className="flex space-x-1">
          <span className="text-xs font-mono text-muted-foreground w-8">7</span>
          {Array.from({ length: 8 }, (_, i) => {
            const bitIndex = 7 - i;
            const isUsed = usedBits.includes(bitIndex);
            return (
              <button
                key={bitIndex}
                onClick={() => onBitToggle?.(bitIndex)}
                className={`w-6 h-6 text-xs font-mono border rounded ${
                  isUsed 
                    ? 'bg-green-500 text-white border-green-600' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                data-testid={`bit-${baseAddress}-${bitIndex}`}
              >
                {bitIndex}
              </button>
            );
          })}
          <span className="text-xs font-mono text-muted-foreground w-8">0</span>
        </div>
      </div>
    </div>
  );
}

export function AddressMappingsTable({ mappings, onMappingsChange }: AddressMappingsTableProps) {
  const { t } = useLanguage();
  
  // State for tracking selected registers (initially all selected)
  const [selectedRegisters, setSelectedRegisters] = useState<Set<number>>(new Set());
  const [expandedBoolChannels, setExpandedBoolChannels] = useState<Set<number>>(new Set());
  const [channelBitStates, setChannelBitStates] = useState<Map<number, Set<number>>>(new Map());

  // Initialize all registers as selected when mappings change
  useEffect(() => {
    const allIndices = new Set(mappings.map((_, index) => index));
    setSelectedRegisters(allIndices);
    
    // Initialize bit states for BOOL CHANNEL entries
    const newBitStates = new Map<number, Set<number>>();
    mappings.forEach((mapping, index) => {
      if (isBoolChannel(mapping)) {
        const usedBits = extractUsedBits(mapping.plc_reg_add);
        newBitStates.set(index, new Set(usedBits));
      }
    });
    setChannelBitStates(newBitStates);
  }, [mappings]);

  // Helper function to identify BOOL CHANNEL entries
  const isBoolChannel = (mapping: AddressMapping) => {
    return mapping.data_type === 'BOOL' && mapping.opcua_reg_add.endsWith('_BC');
  };

  // Helper function to extract used bits from related BOOL entries
  const extractUsedBits = (channelAddress: string): number[] => {
    // For BOOL CHANNEL entries, find all related individual BOOL entries in the mappings
    const baseAddress = channelAddress.split('.')[0];
    const usedBits: number[] = [];
    
    mappings.forEach(mapping => {
      if (mapping.data_type === 'BOOL' && mapping.plc_reg_add.startsWith(baseAddress + '.')) {
        const bitPart = mapping.plc_reg_add.split('.')[1];
        if (bitPart) {
          const bitNumber = parseInt(bitPart);
          if (!isNaN(bitNumber) && bitNumber >= 0 && bitNumber <= 15) {
            usedBits.push(bitNumber);
          }
        }
      }
    });
    
    return usedBits;
  };

  const toggleRegisterSelection = (index: number) => {
    const newSelected = new Set(selectedRegisters);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRegisters(newSelected);
  };

  const toggleBoolChannelExpansion = (index: number) => {
    const newExpanded = new Set(expandedBoolChannels);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedBoolChannels(newExpanded);
  };

  const toggleSelectAll = () => {
    if (selectedRegisters.size === mappings.length) {
      setSelectedRegisters(new Set());
    } else {
      setSelectedRegisters(new Set(mappings.map((_, index) => index)));
    }
  };

  const toggleBit = (channelIndex: number, bitNumber: number) => {
    const newBitStates = new Map(channelBitStates);
    const currentBits = newBitStates.get(channelIndex) || new Set();
    const newBits = new Set(currentBits);
    
    if (newBits.has(bitNumber)) {
      newBits.delete(bitNumber);
    } else {
      newBits.add(bitNumber);
    }
    
    newBitStates.set(channelIndex, newBits);
    setChannelBitStates(newBitStates);

    // Update the mappings to reflect bit changes
    const channelMapping = mappings[channelIndex];
    if (channelMapping && isBoolChannel(channelMapping)) {
      const baseAddress = channelMapping.plc_reg_add.split('.')[0];
      const newMappings = [...mappings];
      
      // Remove old individual BOOL entries for this base address
      const filteredMappings = newMappings.filter(mapping => 
        !(mapping.data_type === 'BOOL' && mapping.plc_reg_add.startsWith(baseAddress + '.') && !mapping.opcua_reg_add.endsWith('_BC'))
      );
      
      // Add new BOOL entries for selected bits
      newBits.forEach(bit => {
        const bitMapping: AddressMapping = {
          plc_reg_add: `${baseAddress}.${bit}`,
          data_type: 'BOOL',
          opcua_reg_add: `${baseAddress}_B${bit.toString().padStart(2, '0')}`
        };
        filteredMappings.push(bitMapping);
      });
      
      onMappingsChange(filteredMappings);
    }
  };

  const addMapping = () => {
    const newMapping: AddressMapping = {
      plc_reg_add: "",
      data_type: "WORD",
      opcua_reg_add: ""
    };
    onMappingsChange([...mappings, newMapping]);
  };

  const updateMapping = (index: number, field: keyof AddressMapping, value: string) => {
    const updatedMappings = mappings.map((mapping, i) => 
      i === index ? { ...mapping, [field]: value } : mapping
    );
    onMappingsChange(updatedMappings);
  };

  const removeMapping = (index: number) => {
    const updatedMappings = mappings.filter((_, i) => i !== index);
    onMappingsChange(updatedMappings);
  };

  return (
    <div data-testid="container-mappings-table">
      <div className="mb-4 flex justify-between items-center">
        <Button 
          onClick={addMapping} 
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          data-testid="button-add-mapping"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('addMappingText')}
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border border-border rounded-lg" data-testid="table-mappings">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground" data-testid="header-select">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedRegisters.size === mappings.length && mappings.length > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span>Select</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground" data-testid="header-plc-reg">
                {t('plcRegHeader')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground" data-testid="header-data-type">
                {t('dataTypeHeader')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground" data-testid="header-opcua-reg">
                {t('opcuaRegHeader')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground" data-testid="header-actions">
                {t('actionsHeader')}
              </th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => {
              const isBoolChannelEntry = isBoolChannel(mapping);
              const isExpanded = expandedBoolChannels.has(index);
              const selectedBits = channelBitStates.get(index) || new Set();
              
              return (
                <Fragment key={index}>
                  <tr 
                    className={`table-row border-t border-border fade-in ${
                      isBoolChannelEntry ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                    }`} 
                    data-testid={`row-mapping-${index}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedRegisters.has(index)}
                          onCheckedChange={() => toggleRegisterSelection(index)}
                          data-testid={`checkbox-select-${index}`}
                        />
                        {isBoolChannelEntry && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleBoolChannelExpansion(index)}
                            className="p-1 h-6 w-6"
                            data-testid={`button-expand-${index}`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={mapping.plc_reg_add}
                        onChange={(e) => updateMapping(index, 'plc_reg_add', e.target.value)}
                        placeholder={t('enterRegisterAddress')}
                        className="text-sm"
                        data-testid={`input-plc-reg-${index}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Select 
                        value={mapping.data_type} 
                        onValueChange={(value: AddressMapping['data_type']) => 
                          updateMapping(index, 'data_type', value)
                        }
                      >
                        <SelectTrigger className="text-sm" data-testid={`select-data-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHANNEL">CHANNEL</SelectItem>
                          <SelectItem value="BOOL">BOOL</SelectItem>
                          <SelectItem value="WORD">WORD</SelectItem>
                          <SelectItem value="UDINT">UDINT</SelectItem>
                          <SelectItem value="DWORD">DWORD</SelectItem>
                          <SelectItem value="INT">INT</SelectItem>
                          <SelectItem value="REAL">REAL</SelectItem>
                          <SelectItem value="LREAL">LREAL</SelectItem>
                          <SelectItem value="int16">int16</SelectItem>
                          <SelectItem value="int32">int32</SelectItem>
                          <SelectItem value="float32">float32</SelectItem>
                          <SelectItem value="bool">bool</SelectItem>
                          <SelectItem value="string">string</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={mapping.opcua_reg_add}
                        onChange={(e) => updateMapping(index, 'opcua_reg_add', e.target.value)}
                        placeholder={t('enterOpcuaRegister')}
                        className="text-sm"
                        data-testid={`input-opcua-reg-${index}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMapping(index)}
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        data-testid={`button-delete-mapping-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                  {/* Expandable Boolean Channel Grid */}
                  {isBoolChannelEntry && isExpanded && (
                    <tr data-testid={`row-expanded-${index}`}>
                      <td colSpan={5} className="px-4 py-0 bg-orange-50 dark:bg-orange-900/20">
                        <BooleanChannelGrid
                          plcAddress={mapping.plc_reg_add}
                          selectedBits={Array.from(selectedBits)}
                          onBitToggle={(bit) => toggleBit(index, bit)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground" data-testid="text-no-mappings">
                  No address mappings configured. Click "Add New Mapping" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
