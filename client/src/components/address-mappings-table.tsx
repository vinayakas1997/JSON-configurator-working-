import { useState, useEffect, useMemo, Fragment, useCallback, memo } from "react";
import { Trash2, Plus, ChevronDown, ChevronRight, Upload, X, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { generateOpcuaName } from "@/lib/plc-parser";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import Papa from "papaparse";
import type { AddressMapping } from "@shared/schema";

interface AddressMappingsTableProps {
  mappings: AddressMapping[];
  onMappingsChange: (mappings: AddressMapping[]) => void;
  selectedMemoryAreas?: Set<string>;
  onSelectedRegistersChange?: (selectedRegisters: Set<number>) => void;
  plcNo?: number | string;
  searchTerm?: string;
  deselectedKeys?: Set<string>;
  onDeselectedKeysChange?: (keys: Set<string>) => void;
}

// 16-bit grid component for boolean channel visualization
const BooleanChannelGrid = memo(({
  plcAddress,
  selectedBits = [],
  onBitToggle
}: {
  plcAddress: string;
  selectedBits?: number[];
  onBitToggle?: (bit: number) => void;
}) => {
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
});

BooleanChannelGrid.displayName = 'BooleanChannelGrid';

// Optimized table row component with React.memo
const TableRow = memo(({
  mapping,
  originalIndex,
  isBoolChannelEntry,
  isModifiedChannelEntry,
  isExpanded,
  selectedBits,
  modifiedBits,
  modifiedComment,
  existingBitData,
  isSelected,
  onToggleSelection,
  onToggleExpansion,
  onUpdateMapping,
  onRemoveMapping,
  onToggleBit,
  onToggleModifiedChannelBit,
  onUpdateModifiedChannelComment,
  t
}: {
  mapping: AddressMapping;
  originalIndex: number;
  isBoolChannelEntry: boolean;
  isModifiedChannelEntry: boolean;
  isExpanded: boolean;
  selectedBits: Set<number>;
  modifiedBits: Set<number>;
  modifiedComment: string;
  existingBitData: { boolBits: number[], modifiedBits: number[] };
  isSelected: boolean;
  onToggleSelection: (index: number) => void;
  onToggleExpansion: (index: number) => void;
  onUpdateMapping: (index: number, field: keyof AddressMapping, value: string) => void;
  onRemoveMapping: (index: number) => void;
  onToggleBit: (channelIndex: number, bitNumber: number) => void;
  onToggleModifiedChannelBit: (mappingIndex: number, bitIndex: number) => void;
  onUpdateModifiedChannelComment: (mappingIndex: number, comment: string) => void;
  t: (key: string) => string;
}) => {
  const baseAddress = mapping.plc_reg_add.split('.')[0];
  
  return (
    <Fragment>
      <tr
        className={`table-row border-t border-border fade-in ${
          isBoolChannelEntry ? 'bg-orange-50 dark:bg-orange-900/20' : isModifiedChannelEntry ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
        data-testid={`row-mapping-${originalIndex}`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(originalIndex)}
              data-testid={`checkbox-select-${originalIndex}`}
            />
            {(isBoolChannelEntry || isModifiedChannelEntry) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleExpansion(originalIndex)}
                className="p-1 h-6 w-6"
                data-testid={`button-expand-${originalIndex}`}
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
            onChange={(e) => onUpdateMapping(originalIndex, 'plc_reg_add', e.target.value)}
            placeholder={t('enterRegisterAddress')}
            className="text-sm"
            data-testid={`input-plc-reg-${originalIndex}`}
          />
        </td>
        <td className="px-4 py-3">
          <Select
            value={mapping.data_type}
            onValueChange={(value: AddressMapping['data_type']) =>
              onUpdateMapping(originalIndex, 'data_type', value)
            }
          >
            <SelectTrigger className="text-sm" data-testid={`select-data-type-${originalIndex}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CHANNEL">CHANNEL</SelectItem>
              <SelectItem value="modified channel">MODIFIED CHANNEL</SelectItem>
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
            onChange={(e) => onUpdateMapping(originalIndex, 'opcua_reg_add', e.target.value)}
            placeholder={t('enterOpcuaRegister')}
            className="text-sm"
            data-testid={`input-opcua-reg-${originalIndex}`}
          />
        </td>
        <td className="px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemoveMapping(originalIndex)}
            className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
            data-testid={`button-delete-mapping-${originalIndex}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </td>
      </tr>
      {/* Expandable Boolean Channel Grid */}
      {isBoolChannelEntry && isExpanded && (
        <tr data-testid={`row-expanded-${originalIndex}`}>
          <td colSpan={5} className="px-4 py-0 bg-orange-50 dark:bg-orange-900/20">
            <BooleanChannelGrid
              plcAddress={mapping.plc_reg_add}
              selectedBits={Array.from(selectedBits)}
              onBitToggle={(bit) => onToggleBit(originalIndex, bit)}
            />
          </td>
        </tr>
      )}
      {/* Expandable Modified Channel Interface */}
      {isModifiedChannelEntry && isExpanded && (
        <tr data-testid={`row-expanded-modified-${originalIndex}`}>
          <td colSpan={5} className="px-4 py-0 bg-blue-50 dark:bg-blue-900/20">
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Modified Channel Configuration - Base: {baseAddress}
              </h4>
              <div className="space-y-4">
                {/* Bit Selection Grid */}
                <div className="space-y-1">
                  <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                    Select Required Bits:
                    {(existingBitData.boolBits.length > 0 || existingBitData.modifiedBits.length > 0) && (
                      <span className="ml-2 text-orange-600 dark:text-orange-400">
                        (Orange = in boolean channel, Yellow = in other modified channels)
                      </span>
                    )}
                  </div>
                  {/* Top row: bits 15-8 */}
                  <div className="flex space-x-1">
                    <span className="text-xs font-mono text-muted-foreground w-8">15</span>
                    {Array.from({ length: 8 }, (_, i) => {
                      const bitIndex = 15 - i;
                      const isSelected = modifiedBits.has(bitIndex);
                      const isBoolExisting = existingBitData.boolBits.includes(bitIndex);
                      const isModifiedExisting = existingBitData.modifiedBits.includes(bitIndex);
                      return (
                        <button
                          key={bitIndex}
                          onClick={() => onToggleModifiedChannelBit(originalIndex, bitIndex)}
                          className={`w-6 h-6 text-xs font-mono border rounded ${
                            isSelected
                              ? 'bg-blue-500 text-white border-blue-600'
                              : isBoolExisting
                              ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 border-orange-400 dark:border-orange-600 hover:bg-orange-300 dark:hover:bg-orange-700'
                              : isModifiedExisting
                              ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 border-yellow-400 dark:border-yellow-600 hover:bg-yellow-300 dark:hover:bg-yellow-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          data-testid={`modified-bit-${mapping.plc_reg_add}-${bitIndex}`}
                          title={isBoolExisting ? 'Bit already in use by boolean channel' : isModifiedExisting ? 'Bit selected in another modified channel' : ''}
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
                      const isSelected = modifiedBits.has(bitIndex);
                      const isBoolExisting = existingBitData.boolBits.includes(bitIndex);
                      const isModifiedExisting = existingBitData.modifiedBits.includes(bitIndex);
                      return (
                        <button
                          key={bitIndex}
                          onClick={() => onToggleModifiedChannelBit(originalIndex, bitIndex)}
                          className={`w-6 h-6 text-xs font-mono border rounded ${
                            isSelected
                              ? 'bg-blue-500 text-white border-blue-600'
                              : isBoolExisting
                              ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 border-orange-400 dark:border-orange-600 hover:bg-orange-300 dark:hover:bg-orange-700'
                              : isModifiedExisting
                              ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 border-yellow-400 dark:border-yellow-600 hover:bg-yellow-300 dark:hover:bg-yellow-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          data-testid={`modified-bit-${mapping.plc_reg_add}-${bitIndex}`}
                          title={isBoolExisting ? 'Bit already in use by boolean channel' : isModifiedExisting ? 'Bit selected in another modified channel' : ''}
                        >
                          {bitIndex}
                        </button>
                      );
                    })}
                    <span className="text-xs font-mono text-muted-foreground w-8">0</span>
                  </div>
                </div>
                {/* Comment Box */}
                <div className="space-y-2">
                  <label className="text-xs text-blue-700 dark:text-blue-300">Description/Comment:</label>
                  <textarea
                    value={modifiedComment}
                    onChange={(e) => onUpdateModifiedChannelComment(originalIndex, e.target.value)}
                    placeholder="Enter description for this modified channel..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200"
                    rows={3}
                    data-testid={`modified-comment-${originalIndex}`}
                  />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
});

TableRow.displayName = 'TableRow';

export function AddressMappingsTable({ mappings, onMappingsChange, selectedMemoryAreas = new Set(), onSelectedRegistersChange, plcNo = 1, searchTerm = "", deselectedKeys = new Set(), onDeselectedKeysChange }: AddressMappingsTableProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  // State for tracking selected registers (initially all selected)
  const [selectedRegisters, setSelectedRegisters] = useState<Set<number>>(new Set());
  const [expandedBoolChannels, setExpandedBoolChannels] = useState<Set<number>>(new Set());
  const [modifiedChannelBits, setModifiedChannelBits] = useState<Map<number, Set<number>>>(new Map());
  const [modifiedChannelComments, setModifiedChannelComments] = useState<Map<number, string>>(new Map());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(500); // Fixed page size for optimal performance
  
  // Group deselect states
  const [groupDeselectExpanded, setGroupDeselectExpanded] = useState<boolean>(false);
  const [manualDeselectInput, setManualDeselectInput] = useState<string>("");
  const [csvParsedCount, setCsvParsedCount] = useState<number>(0);

  // Create a stable hash for mappings to avoid expensive JSON.stringify
  const mappingsHash = useMemo(() => {
    return `${mappings.length}-${mappings.map(m => `${m.plc_reg_add}-${m.data_type}-${m.opcua_reg_add}`).slice(0, 10).join('|')}`;
  }, [mappings.length, mappings.slice(0, 10).map(m => `${m.plc_reg_add}-${m.data_type}-${m.opcua_reg_add}`).join('|')]);

  // Helper function to get valid PLC number (same logic as PlcConfigBuilder)
  const getValidPlcNo = useCallback((): number => {
    const num = typeof plcNo === 'number' ? plcNo : parseInt(plcNo?.toString() || '1');
    return (!isNaN(num) && num > 0) ? num : 1;
  }, [plcNo]);

  // Helper function to identify BOOL CHANNEL entries
  const isBoolChannel = (mapping: AddressMapping) => {
    return (mapping.data_type === 'BOOL' || mapping.data_type === 'CHANNEL') && mapping.opcua_reg_add.endsWith('_BC');
  };

  // Helper function to identify MODIFIED CHANNEL entries (for display purposes)
  const isModifiedChannel = (mapping: AddressMapping) => {
    return mapping.data_type === 'modified channel';
  };
  
  // Helper function to check if a BOOL entry was created by a modified channel
  const isBoolFromModifiedChannel = (mapping: AddressMapping, modifiedChannelIndex: number): boolean => {
    if (mapping.data_type !== 'BOOL' || !mapping.plc_reg_add.includes('.')) return false;
    
    const modifiedMapping = mappings[modifiedChannelIndex];
    if (!modifiedMapping || !isModifiedChannel(modifiedMapping)) return false;
    
    const baseAddress = modifiedMapping.plc_reg_add;
    return mapping.plc_reg_add.startsWith(baseAddress + '.');
  };

  // Efficient helper using bit_list attribute instead of parsing addresses
  const extractUsedBits = (channelAddress: string): number[] => {
    const baseAddress = channelAddress.split('.')[0];
    
    // Find the mapping that corresponds to this channel address
    const channelMapping = mappings.find(mapping => 
      mapping.plc_reg_add === baseAddress && (isBoolChannel(mapping) || isModifiedChannel(mapping))
    );
    
    if (channelMapping && channelMapping.bit_list && Array.isArray(channelMapping.bit_list)) {
      // Use efficient bit_list attribute - no parsing needed!
      return channelMapping.bit_list.filter(bit => bit >= 0 && bit <= 15);
    }
    
    // Fallback: extract from related BOOL entries for backward compatibility
    const usedBits: number[] = [];
    mappings.forEach((mapping) => {
      if (mapping.data_type === 'BOOL' && mapping.plc_reg_add.startsWith(baseAddress + '.')) {
        if (mapping.bit_list && Array.isArray(mapping.bit_list)) {
          // Use bit_list if available
          usedBits.push(...mapping.bit_list.filter(bit => bit >= 0 && bit <= 15));
        } else {
          // Parse address as fallback
          const bitPart = mapping.plc_reg_add.split('.')[1];
          if (bitPart) {
            const bitNumber = parseInt(bitPart);
            if (!isNaN(bitNumber) && bitNumber >= 0 && bitNumber <= 15) {
              usedBits.push(bitNumber);
            }
          }
        }
      }
    });
    
    return Array.from(new Set(usedBits)); // Remove duplicates
  };

  // Efficient helper using bit_list attribute instead of reparsing addresses
  // Use optimized dependency to avoid expensive recalculations
  const getExistingBitData = useMemo(() => {
    const addressToBitsMap = new Map<string, { boolBits: Set<number>, modifiedBits: Set<number> }>();
    
    // Only process first 1000 mappings for initial calculation, then update incrementally
    const relevantMappings = mappings.length > 1000 ? mappings.slice(0, 1000) : mappings;
    
    relevantMappings.forEach((mapping, index) => {
      const mappingBaseAddress = mapping.plc_reg_add.split('.')[0];
      
      if (!addressToBitsMap.has(mappingBaseAddress)) {
        addressToBitsMap.set(mappingBaseAddress, { boolBits: new Set(), modifiedBits: new Set() });
      }
      
      const bitData = addressToBitsMap.get(mappingBaseAddress)!;
      
      // Use bit_list attribute for efficient bit extraction - no parsing needed!
      if (mapping.bit_list && Array.isArray(mapping.bit_list)) {
        mapping.bit_list.forEach((bit: number) => {
          if (typeof bit === 'number' && bit >= 0 && bit <= 15) {
            if (isBoolChannel(mapping)) {
              bitData.boolBits.add(bit);
            } else if (isModifiedChannel(mapping)) {
              bitData.modifiedBits.add(bit);
            } else if (mapping.data_type === 'BOOL') {
              bitData.boolBits.add(bit);
            }
          }
        });
      }
      
      // Fallback: Extract bits from metadata (for backward compatibility)
      if (!mapping.bit_list) {
        if (isBoolChannel(mapping) && (mapping as any).metadata?.bit_mappings) {
          const bitMappings = (mapping as any).metadata.bit_mappings;
          Object.values(bitMappings).forEach((bitInfo: any) => {
            if (typeof bitInfo.bit_position === 'number' && bitInfo.bit_position >= 0 && bitInfo.bit_position <= 15) {
              bitData.boolBits.add(bitInfo.bit_position);
            }
          });
        }
        
        if (isModifiedChannel(mapping) && (mapping as any).metadata?.bit_mappings) {
          const bitMappings = (mapping as any).metadata.bit_mappings;
          Object.values(bitMappings).forEach((bitInfo: any) => {
            if (typeof bitInfo.bit_position === 'number' && bitInfo.bit_position >= 0 && bitInfo.bit_position <= 15) {
              bitData.modifiedBits.add(bitInfo.bit_position);
            }
          });
        }
        
        // Extract bits from individual BOOL entries (parsing fallback)
        if (mapping.data_type === 'BOOL' && mapping.plc_reg_add.includes('.')) {
          const bitPart = mapping.plc_reg_add.split('.')[1];
          if (bitPart) {
            const bitNumber = parseInt(bitPart);
            if (!isNaN(bitNumber) && bitNumber >= 0 && bitNumber <= 15) {
              bitData.boolBits.add(bitNumber);
            }
          }
        }
      }
    });
    
    return addressToBitsMap;
  }, [mappingsHash]); // Use optimized hash instead of full mappings array
  
  // Helper to count total selected bits in all modified channels
  const getTotalModifiedChannelBits = (): number => {
    let totalBits = 0;
    mappings.forEach((mapping, index) => {
      if (isModifiedChannel(mapping) && selectedRegisters.has(index)) {
        const selectedBits = modifiedChannelBits.get(index) || new Set<number>();
        totalBits += selectedBits.size;
      }
    });
    return totalBits;
  };

  // Helper to get existing bits for a specific address excluding current mapping
  const getExistingBitsForAddress = (baseAddress: string, currentIndex: number): { boolBits: number[], modifiedBits: number[] } => {
    const bitData = getExistingBitData.get(baseAddress);
    if (!bitData) {
      return { boolBits: [], modifiedBits: [] };
    }
    
    // Get current mapping's selected bits to exclude from modified bits (using bit_list)
    const currentMapping = mappings[currentIndex];
    const currentModifiedBits = new Set<number>();
    if (isModifiedChannel(currentMapping)) {
      if (currentMapping.bit_list && Array.isArray(currentMapping.bit_list)) {
        // Use efficient bit_list attribute
        currentMapping.bit_list.forEach((bit: number) => currentModifiedBits.add(bit));
      } else if ((currentMapping as any).metadata?.bit_mappings) {
        // Fallback to metadata parsing
        const bitMappings = (currentMapping as any).metadata.bit_mappings;
        Object.values(bitMappings).forEach((bitInfo: any) => {
          if (typeof bitInfo.bit_position === 'number') {
            currentModifiedBits.add(bitInfo.bit_position);
          }
        });
      }
    }
    
    // Filter out current mapping's bits from modified bits
    const filteredModifiedBits = Array.from(bitData.modifiedBits).filter(bit => !currentModifiedBits.has(bit));
    
    return {
      boolBits: Array.from(bitData.boolBits),
      modifiedBits: filteredModifiedBits
    };
  };

  // Helper function to classify memory area from mapping
  const getMemoryAreaFromMapping = (mapping: AddressMapping): string => {
    const firstChar = mapping.plc_reg_add.charAt(0).toUpperCase();
    // Group I and O into I/O, and numeric addresses as I/O
    if (firstChar === 'I' || firstChar === 'O' || /^\d/.test(mapping.plc_reg_add)) {
      return 'I/O';
    }
    return firstChar;
  };

  // Create filtered and searched visible mappings with pagination
  const { visibleMappings, totalPages, totalFilteredCount } = useMemo(() => {
    const filteredMappings = mappings.map((mapping, originalIndex) => ({ mapping, originalIndex }))
      .filter(({ mapping }) => {
        // Always show empty addresses (new mappings)
        if (!mapping.plc_reg_add || mapping.plc_reg_add.trim() === '') return true;
        const memoryArea = getMemoryAreaFromMapping(mapping);
        return selectedMemoryAreas.has(memoryArea);
      });

    let finalMappings = filteredMappings;

    // Apply search filtering if searchTerm exists
    if (searchTerm && searchTerm.trim() !== '') {
      const searchTermLower = searchTerm.toLowerCase();
      const matchingMappings: Array<{ mapping: AddressMapping; originalIndex: number; isMatch: boolean }> = [];

      filteredMappings.forEach(({ mapping, originalIndex }) => {
        const plcRegAdd = mapping.plc_reg_add.toLowerCase();
        const opcuaRegAdd = mapping.opcua_reg_add.toLowerCase();
        const description = (mapping.description || '').toLowerCase();
        
        const isMatch = plcRegAdd.includes(searchTermLower) ||
                        opcuaRegAdd.includes(searchTermLower) ||
                        description.includes(searchTermLower);
        
        matchingMappings.push({ mapping, originalIndex, isMatch });
      });

      // Sort: matches first, then non-matches
      matchingMappings.sort((a, b) => {
        if (a.isMatch && !b.isMatch) return -1;
        if (!a.isMatch && b.isMatch) return 1;
        return 0;
      });

      finalMappings = matchingMappings.map(({ mapping, originalIndex }) => ({ mapping, originalIndex }));
    }

    // Calculate pagination
    const totalCount = finalMappings.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);
    const paginatedMappings = finalMappings.slice(startIndex, endIndex);

    return {
      visibleMappings: paginatedMappings,
      totalPages,
      totalFilteredCount: totalCount
    };
  }, [mappings, selectedMemoryAreas, searchTerm, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm, selectedMemoryAreas, mappingsHash]);

  // Initialize registers as selected only on first render
  useEffect(() => {
    const visibleIndices = new Set(visibleMappings.map(({ originalIndex }) => originalIndex));
    // Only initialize if selectedRegisters is empty to preserve user selections
    setSelectedRegisters(prev => prev.size === 0 ? visibleIndices : prev);
  }, [visibleMappings.length]); // Only depend on length changes, not content changes

  // Sync deselectedKeys with selectedRegisters whenever mappings or deselectedKeys change
  useEffect(() => {
    if (deselectedKeys.size > 0) {
      updateSelectedRegistersFromDeselected(deselectedKeys);
    }
  }, [mappings, deselectedKeys]);

  // Notify parent when selectedRegisters changes
  useEffect(() => {
    if (onSelectedRegistersChange) {
      onSelectedRegistersChange(selectedRegisters);
    }
  }, [selectedRegisters, onSelectedRegistersChange]);

  // Derive bit states directly from current mappings (more reliable than useEffect)
  // Use optimized dependency instead of expensive JSON.stringify
  const channelBitStates = useMemo(() => {
    const newBitStates = new Map<number, Set<number>>();
    // Only process visible mappings and their related entries for better performance
    const relevantIndices = new Set(visibleMappings.map(({ originalIndex }) => originalIndex));
    
    mappings.forEach((mapping, index) => {
      if (isBoolChannel(mapping) && (relevantIndices.has(index) || relevantIndices.size === 0)) {
        const usedBits = extractUsedBits(mapping.plc_reg_add);
        newBitStates.set(index, new Set(usedBits));
      }
    });
    return newBitStates;
  }, [mappingsHash, visibleMappings.length]); // Use optimized dependencies

  // Initialize modified channel bits from metadata when mappings change
  useEffect(() => {
    const newModifiedBits = new Map<number, Set<number>>();
    const newModifiedComments = new Map<number, string>();
    
    mappings.forEach((mapping, index) => {
      if (isModifiedChannel(mapping)) {
        // Initialize bits from metadata
        const metadata = (mapping as any).metadata;
        if (metadata && metadata.bit_mappings) {
          const bits = new Set<number>();
          Object.values(metadata.bit_mappings).forEach((bitInfo: any) => {
            if (typeof bitInfo.bit_position === 'number' && bitInfo.bit_position >= 0 && bitInfo.bit_position <= 15) {
              bits.add(bitInfo.bit_position);
            }
          });
          newModifiedBits.set(index, bits);
        }
        
        // Initialize comments from description
        if (mapping.description) {
          newModifiedComments.set(index, mapping.description);
        }
      }
    });
    
    setModifiedChannelBits(newModifiedBits);
    setModifiedChannelComments(newModifiedComments);
  }, [mappings]);

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

  // Handler for modified channel bit selection - updates metadata with bit_mappings
  const toggleModifiedChannelBit = (mappingIndex: number, bitIndex: number) => {
    setModifiedChannelBits(prev => {
      const newMap = new Map(prev);
      const currentBits = newMap.get(mappingIndex) || new Set<number>();
      const newBits = new Set<number>(currentBits);
      
      if (newBits.has(bitIndex)) {
        newBits.delete(bitIndex);
      } else {
        newBits.add(bitIndex);
      }
      
      newMap.set(mappingIndex, newBits);
      
      // Update the mapping with proper metadata structure
      const updatedMappings = mappings.map((mapping, index) => {
        if (index === mappingIndex) {
          const comment = modifiedChannelComments.get(mappingIndex) || '';
          const baseAddress = mapping.plc_reg_add;
          
          // Create bit_mappings object
          const bit_mappings: any = {};
          Array.from(newBits).forEach((bit: number) => {
            const bitKey = `bit_${bit.toString().padStart(2, '0')}`;
            bit_mappings[bitKey] = {
              address: `${baseAddress}.${bit.toString().padStart(2, '0')}`,
              description: comment,
              bit_position: bit
            };
          });
          
          return {
            ...mapping,
            metadata: {
              bit_count: newBits.size,
              bit_mappings
            }
          };
        }
        return mapping;
      });
      
      onMappingsChange(updatedMappings);
      return newMap;
    });
  };

  // Handler for modified channel comment updates - updates metadata bit_mappings
  const updateModifiedChannelComment = (mappingIndex: number, comment: string) => {
    setModifiedChannelComments(prev => {
      const newMap = new Map(prev);
      newMap.set(mappingIndex, comment);
      return newMap;
    });
    
    // Update the description field and metadata
    const updatedMappings = mappings.map((mapping, index) => {
      if (index === mappingIndex && isModifiedChannel(mapping)) {
        const currentBits = modifiedChannelBits.get(mappingIndex) || new Set<number>();
        const baseAddress = mapping.plc_reg_add;
        
        // Create bit_mappings object with updated description
        const bit_mappings: any = {};
        Array.from(currentBits).forEach((bit: number) => {
          const bitKey = `bit_${bit.toString().padStart(2, '0')}`;
          bit_mappings[bitKey] = {
            address: `${baseAddress}.${bit.toString().padStart(2, '0')}`,
            description: comment,
            bit_position: bit
          };
        });
        
        return {
          ...mapping,
          description: comment,
          metadata: {
            bit_count: currentBits.size,
            bit_mappings
          }
        };
      }
      return mapping;
    });
    
    onMappingsChange(updatedMappings);
  };

  const toggleSelectAll = () => {
    const visibleIndices = visibleMappings.map(({ originalIndex }) => originalIndex);
    if (selectedRegisters.size === visibleIndices.length && visibleIndices.length > 0) {
      setSelectedRegisters(new Set());
    } else {
      setSelectedRegisters(new Set(visibleIndices));
    }
  };

  const toggleBit = (channelIndex: number, bitNumber: number) => {
    const channelMapping = mappings[channelIndex];
    if (channelMapping && isBoolChannel(channelMapping)) {
      const baseAddress = channelMapping.plc_reg_add.split('.')[0];
      const currentBits = channelBitStates.get(channelIndex) || new Set();
      
      // Create new mappings array
      let newMappings = [...mappings];
      
      // Remove old individual BOOL entries for this base address
      newMappings = newMappings.filter(mapping => 
        !(mapping.data_type === 'BOOL' && mapping.plc_reg_add.startsWith(baseAddress + '.') && !mapping.opcua_reg_add.endsWith('_BC'))
      );
      
      // Toggle the bit and create new bit set
      const newBits = new Set(currentBits);
      if (newBits.has(bitNumber)) {
        newBits.delete(bitNumber);
      } else {
        newBits.add(bitNumber);
      }
      
      // Add new BOOL entries for selected bits with proper PLC number prefix
      const validPlcNumber = getValidPlcNo();
      newBits.forEach((bit: number) => {
        const bitAddress = `${baseAddress}.${bit.toString().padStart(2, '0')}`;
        const opcuaName = generateOpcuaName(baseAddress, 'BOOL', bit.toString().padStart(2, '0'), false, validPlcNumber);
        
        const bitMapping: AddressMapping = {
          plc_reg_add: bitAddress,
          data_type: 'BOOL',
          opcua_reg_add: opcuaName
        };
        newMappings.push(bitMapping);
      });
      
      onMappingsChange(newMappings);
    }
  };

  const addMapping = () => {
    const newMapping: AddressMapping = {
      plc_reg_add: "",
      data_type: "WORD",
      opcua_reg_add: ""
    };
    // Add new mapping at the top of the list so user can see it easily
    onMappingsChange([newMapping, ...mappings]);
    
    // Update selectedRegisters to account for the new mapping at index 0
    // All existing indices shift by 1, and select the new mapping at index 0
    const updatedSelectedRegisters = new Set<number>();
    selectedRegisters.forEach(index => updatedSelectedRegisters.add(index + 1));
    updatedSelectedRegisters.add(0); // Select the new mapping
    setSelectedRegisters(updatedSelectedRegisters);
  };

  // Group deselect handlers
  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        try {
          const registers: string[] = [];
          const data = results.data as string[][];
          
          data.forEach((row) => {
            if (row && row.length > 0 && row[0] && row[0].trim()) {
              const register = row[0].trim();
              if (register) {
                registers.push(register);
              }
            }
          });
          
          setCsvParsedCount(registers.length);
          
          if (registers.length > 0) {
            toast({
              title: "CSV Parsed",
              description: `Found ${registers.length} registers for deselection.`,
            });
          }
          
          // Store parsed registers temporarily for bulk deselect
          (window as any)._tempDeselectRegisters = registers;
        } catch (error) {
          console.error('Error parsing CSV:', error);
          toast({
            title: "Parse Error",
            description: "Failed to parse the CSV file.",
            variant: "destructive",
          });
        }
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        toast({
          title: "Upload Error", 
          description: "Failed to read the CSV file.",
          variant: "destructive",
        });
      },
      header: false,
      skipEmptyLines: true,
    });
  };

  const handleBulkDeselect = () => {
    const registers = (window as any)._tempDeselectRegisters as string[];
    if (!registers || registers.length === 0) return;

    const newDeselectedKeys = new Set([...Array.from(deselectedKeys), ...registers]);
    onDeselectedKeysChange?.(newDeselectedKeys);
    
    // Update selectedRegisters to reflect deselection
    updateSelectedRegistersFromDeselected(newDeselectedKeys);
    
    toast({
      title: "Bulk Deselected",
      description: `Deselected ${registers.length} registers.`,
    });
    
    setCsvParsedCount(0);
    (window as any)._tempDeselectRegisters = [];
  };

  const handleManualDeselect = () => {
    const register = manualDeselectInput.trim();
    if (!register) return;

    const newDeselectedKeys = new Set([...Array.from(deselectedKeys), register]);
    onDeselectedKeysChange?.(newDeselectedKeys);
    
    // Update selectedRegisters to reflect deselection
    updateSelectedRegistersFromDeselected(newDeselectedKeys);
    
    toast({
      title: "Register Deselected",
      description: `Deselected register: ${register}`,
    });
    
    setManualDeselectInput("");
  };

  const handleClearDeselected = () => {
    const newDeselectedKeys = new Set<string>();
    onDeselectedKeysChange?.(newDeselectedKeys);
    updateSelectedRegistersFromDeselected(newDeselectedKeys);
    
    toast({
      title: "Deselection Cleared",
      description: "All registers are now selected again.",
    });
  };

  // Helper to update selectedRegisters based on deselectedKeys
  const updateSelectedRegistersFromDeselected = (deselectedSet: Set<string>) => {
    const newSelectedRegisters = new Set<number>();
    
    mappings.forEach((mapping, index) => {
      const baseRegister = mapping.plc_reg_add.split('.')[0];
      const fullRegister = mapping.plc_reg_add;
      
      // Check if this mapping should be deselected
      const isDeselected = deselectedSet.has(baseRegister) || deselectedSet.has(fullRegister);
      
      if (!isDeselected) {
        newSelectedRegisters.add(index);
      }
    });
    
    setSelectedRegisters(newSelectedRegisters);
  };

  // Debounced update mapping to prevent excessive re-renders during typing
  const debouncedUpdateMapping = useDebouncedCallback(
    (index: number, field: keyof AddressMapping, value: string) => {
      const updatedMappings = mappings.map((mapping, i) => {
        if (i === index) {
          const updatedMapping = { ...mapping, [field]: value };
          
          // Auto-generate OPC UA register when PLC address or data type changes
          if (field === 'plc_reg_add' || field === 'data_type') {
            const plcAddress = field === 'plc_reg_add' ? value : mapping.plc_reg_add;
            const dataType = field === 'data_type' ? value : mapping.data_type;
            
            if (plcAddress && dataType) {
              const plcNumber = getValidPlcNo(); // Use robust validation instead of fallback logic
              const baseAddr = plcAddress.split('.')[0];
              let newOpcuaName: string;
              
              if (dataType === 'CHANNEL') {
                newOpcuaName = generateOpcuaName(baseAddr, 'CHANNEL', undefined, false, plcNumber);
              } else if (dataType === 'modified channel') {
                newOpcuaName = generateOpcuaName(baseAddr, 'MODIFIED CHANNEL', undefined, false, plcNumber);
              } else if (dataType === 'BOOL' && plcAddress.includes('.')) {
                const bitPosition = plcAddress.split('.')[1];
                newOpcuaName = generateOpcuaName(baseAddr, 'BOOL', bitPosition, false, plcNumber);
              } else {
                newOpcuaName = generateOpcuaName(baseAddr, dataType, undefined, false, plcNumber);
              }
              
              updatedMapping.opcua_reg_add = newOpcuaName;
            }
          }
          
          return updatedMapping;
        }
        return mapping;
      });
      onMappingsChange(updatedMappings);
    },
    300
  );

  // Immediate update mapping for non-text fields (no debounce needed)
  const updateMapping = useCallback((index: number, field: keyof AddressMapping, value: string) => {
    // For select dropdowns and non-text inputs, update immediately
    if (field === 'data_type') {
      debouncedUpdateMapping(index, field, value);
      return;
    }
    
    // For text inputs, use debounced update
    debouncedUpdateMapping(index, field, value);
  }, [debouncedUpdateMapping]);

  const removeMapping = (index: number) => {
    const updatedMappings = mappings.filter((_, i) => i !== index);
    onMappingsChange(updatedMappings);
    
    // Update selectedRegisters to account for the removed mapping
    const updatedSelectedRegisters = new Set<number>();
    selectedRegisters.forEach(selectedIndex => {
      if (selectedIndex < index) {
        // Indices before the removed one stay the same
        updatedSelectedRegisters.add(selectedIndex);
      } else if (selectedIndex > index) {
        // Indices after the removed one shift down by 1
        updatedSelectedRegisters.add(selectedIndex - 1);
      }
      // selectedIndex === index is not added (it's removed)
    });
    setSelectedRegisters(updatedSelectedRegisters);
  };

  return (
    <div data-testid="container-mappings-table">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button 
            onClick={addMapping} 
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            data-testid="button-add-mapping"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('addMappingText')}
          </Button>
          
          {/* Group Deselect Section */}
          <Collapsible open={groupDeselectExpanded} onOpenChange={setGroupDeselectExpanded}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="flex items-center space-x-2"
                data-testid="button-group-deselect-toggle"
              >
                <ChevronDown 
                  className={`w-4 h-4 transition-transform ${
                    groupDeselectExpanded ? 'rotate-180' : ''
                  }`} 
                />
                <span>Group Deselect</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute z-10 bg-background border rounded-lg shadow-lg p-4 mt-2 min-w-80">
              <div className="space-y-4">
                {/* CSV Upload Section */}
                <div>
                  <h4 className="text-sm font-medium mb-2">CSV Upload for Bulk Deselect</h4>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleCsvUpload}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                      data-testid="input-csv-upload"
                    />
                    {csvParsedCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Parsed {csvParsedCount} registers
                        </span>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={handleBulkDeselect}
                          data-testid="button-bulk-deselect"
                        >
                          Deselect
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Manual Deselect Section */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Manual Register Deselect</h4>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      placeholder="Enter register address (e.g., C0001, 2.01)..."
                      value={manualDeselectInput}
                      onChange={(e) => setManualDeselectInput(e.target.value)}
                      className="flex-1"
                      data-testid="input-manual-deselect"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleManualDeselect}
                      disabled={!manualDeselectInput.trim()}
                      data-testid="button-manual-deselect"
                    >
                      Add
                    </Button>
                  </div>
                </div>
                
                {/* Current Deselected Count */}
                {deselectedKeys.size > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      {deselectedKeys.size} registers deselected
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleClearDeselected}
                      data-testid="button-clear-deselected"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      
      {/* Dynamic variable count display and pagination */}
      <div className="mb-4 px-2 flex justify-between items-center">
        <span className="text-sm font-medium text-muted-foreground" data-testid="text-total-selected">
          total selected variable = {selectedRegisters.size + getTotalModifiedChannelBits()}
        </span>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages} ({totalFilteredCount} total records)
            </span>
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
                data-testid="button-first-page"
              >
                ««
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage >= totalPages - 1}
                data-testid="button-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
                data-testid="button-last-page"
              >
                »»
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border border-border rounded-lg" data-testid="table-mappings">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground" data-testid="header-select">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedRegisters.size === visibleMappings.length && visibleMappings.length > 0}
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
            {visibleMappings.map(({ mapping, originalIndex }) => {
              const isBoolChannelEntry = isBoolChannel(mapping);
              const isModifiedChannelEntry = isModifiedChannel(mapping);
              const isExpanded = expandedBoolChannels.has(originalIndex);
              const selectedBits = channelBitStates.get(originalIndex) || new Set();
              const modifiedBits = modifiedChannelBits.get(originalIndex) || new Set();
              const modifiedComment = modifiedChannelComments.get(originalIndex) || '';
              const baseAddress = mapping.plc_reg_add.split('.')[0];
              const existingBitData = isModifiedChannelEntry ? getExistingBitsForAddress(baseAddress, originalIndex) : { boolBits: [], modifiedBits: [] };
              
              return (
                <Fragment key={originalIndex}>
                  <tr 
                    className={`table-row border-t border-border fade-in ${
                      isBoolChannelEntry ? 'bg-orange-50 dark:bg-orange-900/20' : isModifiedChannelEntry ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`} 
                    data-testid={`row-mapping-${originalIndex}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedRegisters.has(originalIndex)}
                          onCheckedChange={() => toggleRegisterSelection(originalIndex)}
                          data-testid={`checkbox-select-${originalIndex}`}
                        />
                        {(isBoolChannelEntry || isModifiedChannelEntry) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleBoolChannelExpansion(originalIndex)}
                            className="p-1 h-6 w-6"
                            data-testid={`button-expand-${originalIndex}`}
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
                        onChange={(e) => updateMapping(originalIndex, 'plc_reg_add', e.target.value)}
                        placeholder={t('enterRegisterAddress')}
                        className="text-sm"
                        data-testid={`input-plc-reg-${originalIndex}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Select 
                        value={mapping.data_type} 
                        onValueChange={(value: AddressMapping['data_type']) => 
                          updateMapping(originalIndex, 'data_type', value)
                        }
                      >
                        <SelectTrigger className="text-sm" data-testid={`select-data-type-${originalIndex}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHANNEL">CHANNEL</SelectItem>
                          <SelectItem value="modified channel">MODIFIED CHANNEL</SelectItem>
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
                        onChange={(e) => updateMapping(originalIndex, 'opcua_reg_add', e.target.value)}
                        placeholder={t('enterOpcuaRegister')}
                        className="text-sm"
                        data-testid={`input-opcua-reg-${originalIndex}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMapping(originalIndex)}
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        data-testid={`button-delete-mapping-${originalIndex}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                  {/* Expandable Boolean Channel Grid */}
                  {isBoolChannelEntry && isExpanded && (
                    <tr data-testid={`row-expanded-${originalIndex}`}>
                      <td colSpan={5} className="px-4 py-0 bg-orange-50 dark:bg-orange-900/20">
                        <BooleanChannelGrid
                          plcAddress={mapping.plc_reg_add}
                          selectedBits={Array.from(selectedBits)}
                          onBitToggle={(bit) => toggleBit(originalIndex, bit)}
                        />
                      </td>
                    </tr>
                  )}
                  {/* Expandable Modified Channel Interface */}
                  {isModifiedChannelEntry && isExpanded && (
                    <tr data-testid={`row-expanded-modified-${originalIndex}`}>
                      <td colSpan={5} className="px-4 py-0 bg-blue-50 dark:bg-blue-900/20">
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
                          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                            Modified Channel Configuration - Base: {mapping.plc_reg_add.split('.')[0]}
                          </h4>
                          <div className="space-y-4">
                            {/* Bit Selection Grid */}
                            <div className="space-y-1">
                              <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                                Select Required Bits:
                                {(existingBitData.boolBits.length > 0 || existingBitData.modifiedBits.length > 0) && (
                                  <span className="ml-2 text-orange-600 dark:text-orange-400">
                                    (Orange = in boolean channel, Yellow = in other modified channels)
                                  </span>
                                )}
                              </div>
                              {/* Top row: bits 15-8 */}
                              <div className="flex space-x-1">
                                <span className="text-xs font-mono text-muted-foreground w-8">15</span>
                                {Array.from({ length: 8 }, (_, i) => {
                                  const bitIndex = 15 - i;
                                  const isSelected = modifiedBits.has(bitIndex);
                                  const isBoolExisting = existingBitData.boolBits.includes(bitIndex);
                                  const isModifiedExisting = existingBitData.modifiedBits.includes(bitIndex);
                                  return (
                                    <button
                                      key={bitIndex}
                                      onClick={() => toggleModifiedChannelBit(originalIndex, bitIndex)}
                                      className={`w-6 h-6 text-xs font-mono border rounded ${
                                        isSelected 
                                          ? 'bg-blue-500 text-white border-blue-600' 
                                          : isBoolExisting
                                          ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 border-orange-400 dark:border-orange-600 hover:bg-orange-300 dark:hover:bg-orange-700'
                                          : isModifiedExisting
                                          ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 border-yellow-400 dark:border-yellow-600 hover:bg-yellow-300 dark:hover:bg-yellow-700'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                                      }`}
                                      data-testid={`modified-bit-${mapping.plc_reg_add}-${bitIndex}`}
                                      title={isBoolExisting ? 'Bit already in use by boolean channel' : isModifiedExisting ? 'Bit selected in another modified channel' : ''}
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
                                  const isSelected = modifiedBits.has(bitIndex);
                                  const isBoolExisting = existingBitData.boolBits.includes(bitIndex);
                                  const isModifiedExisting = existingBitData.modifiedBits.includes(bitIndex);
                                  return (
                                    <button
                                      key={bitIndex}
                                      onClick={() => toggleModifiedChannelBit(originalIndex, bitIndex)}
                                      className={`w-6 h-6 text-xs font-mono border rounded ${
                                        isSelected 
                                          ? 'bg-blue-500 text-white border-blue-600' 
                                          : isBoolExisting
                                          ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 border-orange-400 dark:border-orange-600 hover:bg-orange-300 dark:hover:bg-orange-700'
                                          : isModifiedExisting
                                          ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 border-yellow-400 dark:border-yellow-600 hover:bg-yellow-300 dark:hover:bg-yellow-700'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                                      }`}
                                      data-testid={`modified-bit-${mapping.plc_reg_add}-${bitIndex}`}
                                      title={isBoolExisting ? 'Bit already in use by boolean channel' : isModifiedExisting ? 'Bit selected in another modified channel' : ''}
                                    >
                                      {bitIndex}
                                    </button>
                                  );
                                })}
                                <span className="text-xs font-mono text-muted-foreground w-8">0</span>
                              </div>
                            </div>
                            {/* Comment Box */}
                            <div className="space-y-2">
                              <label className="text-xs text-blue-700 dark:text-blue-300">Description/Comment:</label>
                              <textarea
                                value={modifiedComment}
                                onChange={(e) => updateModifiedChannelComment(originalIndex, e.target.value)}
                                placeholder="Enter description for this modified channel..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200"
                                rows={3}
                                data-testid={`modified-comment-${originalIndex}`}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visibleMappings.length === 0 && (
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
