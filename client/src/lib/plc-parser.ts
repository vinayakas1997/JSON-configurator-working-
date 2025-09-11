// PLC Address Parser - Based on Python parsing logic
import type { AddressMapping } from "@shared/schema";

// Data type dictionary for other data types (key: data_type, value: suffix_number)
const DATA_TYPE_DICTIONARY: { [key: string]: number } = {
  'UDINT': 2,
  'WORD': 1,
  'DWORD': 3,
  'INT': 1,
  'REAL': 4,
  'LREAL': 8
};

export interface ParsedRecord {
  data_type: string;
  address: string;
  description: string;
  value?: string;
}

export interface ParseResult {
  addressMappings: AddressMapping[];
  stats: {
    totalRecords: number;
    validRecords: number;
    skippedRecords: number;
    booleanChannels: number;
  };
  skippedAddresses: Array<{
    address: string;
    data_type: string;
    description: string;
    reason: string;
  }>;
  modifiedChannelAddresses: string[]; // Original BOOL addresses that were combined into CHANNEL types
}

/**
 * Normalize E-type addresses:
 * - If length == 4 (e.g., E0999), convert to E00999 (add 0 after E)
 * - If length == 5 (e.g., E1000), keep as is
 */
export function normalizeEAddress(address: string): string {
  if (address.startsWith('E')) {
    const numericPart = address.slice(1);
    if (numericPart.length === 4) {
      return 'E0' + numericPart;
    } else if (numericPart.length === 3) {
      return 'E00' + numericPart;
    } else if (numericPart.length === 2) {
      return 'E000' + numericPart;
    } else if (numericPart.length === 1) {
      return 'E0000' + numericPart;
    }
  }
  return address;
}

/**
 * Normalize boolean addresses according to special conditions:
 * a) If address is just a number (like "1100"), convert to "1100.00"
 * b) If address has single digit after decimal (like "1100.1"), convert to "1100.10"
 */
export function normalizeBooleanAddress(address: string): string {
  if (!address.includes('.')) {
    // Case a: Just a number, add .00
    return `${address}.00`;
  } else {
    // Case b: Has decimal point, check if bit position needs padding
    const [baseAddress, bitPosition] = address.split('.', 2);
    // Pad bit position to 2 digits
    const normalizedBit = bitPosition.padStart(2, '0');
    return `${baseAddress}.${normalizedBit}`;
  }
}

/**
 * Extract the memory area prefix from an address.
 * Returns the first letter of the address (e.g., 'A' from 'A200', 'D' from 'D1000')
 * For numeric addresses, returns 'A' as default.
 */
export function getMemoryAreaPrefix(address: string): string {
  if (!address) {
    return 'A';
  }
  
  if (/^\d/.test(address)) {
    return 'A'; // Default to 'A' for numeric addresses
  }
  
  return address[0].toUpperCase();
}

/**
 * Generate OPCUA naming convention with format: P{plc_number}_{memory_prefix}_{reg_address}_{suffix}
 */
export function generateOpcuaName(
  address: string, 
  dataType: string, 
  bitPosition?: string, 
  isBooleanChannel: boolean = false, 
  plcNumber: number = 1
): string {
  const memoryPrefix = getMemoryAreaPrefix(address);
  
  // Extract the numeric part of the address
  const regAddress = /^\d/.test(address) ? address : address.slice(1);
  
  // Handle different cases
  if (dataType === 'BOOL') {
    if (isBooleanChannel) {
      // Case a: Multiple bool to type channel
      return `P${plcNumber}_${memoryPrefix}_${regAddress}_BC`;
    } else {
      // Case b: Individual boolean
      const bitNum = bitPosition || "00";
      return `P${plcNumber}_${memoryPrefix}_${regAddress}_B${bitNum}`;
    }
  } else if (dataType === 'CHANNEL' || dataType === 'channel') {
    // Case c: For channel
    return `P${plcNumber}_${memoryPrefix}_${regAddress}_C`;
  } else {
    // Case d: Other data types
    const suffixValue = DATA_TYPE_DICTIONARY[dataType.toUpperCase()] || 1;
    return `P${plcNumber}_${memoryPrefix}_${regAddress}_W${suffixValue}`;
  }
}

/**
 * Check if the address starts with supported memory area prefixes.
 * Supported areas: D, W, H, A, E, T, C (and numeric addresses)
 */
export function isSupportedMemoryArea(address: string): boolean {
  if (!address) {
    return false;
  }
  
  // Check for two-character memory areas (like CF) - not supported
  if (address.length >= 3 && !/[\d.]/.test(address[1])) {
    return false;
  }
  
  // Check if address starts with a digit (numeric addresses)
  if (/^\d/.test(address)) {
    return true;
  }
  
  // Check if address starts with supported memory area prefixes
  const supportedPrefixes = ['D', 'W', 'H', 'A', 'E', 'T', 'C'];
  return supportedPrefixes.some(prefix => address.startsWith(prefix));
}

/**
 * Parse CSV data and create address mappings using the Python logic
 */
export function parseCSVData(csvData: string[][], plcNumber: number = 1): ParseResult {
  const booleanGroups = new Map<string, Array<{
    originalAddress: string;
    normalizedAddress: string;
    bitPosition: string;
    description: string;
    value: string;
  }>>();
  
  const otherMappings: AddressMapping[] = [];
  const skippedAddresses: Array<{
    address: string;
    data_type: string;
    description: string;
    reason: string;
  }> = [];

  // Process each CSV row
  for (const row of csvData) {
    if (row.length < 4) continue; // Ensure we have enough columns
    
    const item: ParsedRecord = {
      data_type: row[1],
      address: row[2],
      description: row[3],
      value: row[4] || '0'
    };

    // Check if address is supported
    if (!isSupportedMemoryArea(item.address)) {
      skippedAddresses.push({
        address: item.address,
        data_type: item.data_type,
        description: item.description,
        reason: 'Unsupported memory area'
      });
      continue;
    }

    // Apply E address normalization
    const originalAddress = item.address;
    let normalizedAddress = normalizeEAddress(originalAddress);
    
    if (item.data_type === 'BOOL') {
      // Normalize the boolean address according to special conditions
      normalizedAddress = normalizeBooleanAddress(normalizedAddress);
      
      // Extract base address and bit position from normalized address
      const [baseAddress, bitPosition] = normalizedAddress.split('.');
      
      // Group addresses with the same base
      if (!booleanGroups.has(baseAddress)) {
        booleanGroups.set(baseAddress, []);
      }
      booleanGroups.get(baseAddress)!.push({
        originalAddress,
        normalizedAddress,
        bitPosition,
        description: item.description,
        value: item.value || '0'
      });
    } else if (item.data_type === 'CHANNEL') {
      // Handle CHANNEL data type
      const opcuaName = generateOpcuaName(normalizedAddress, 'CHANNEL', undefined, false, plcNumber);
      
      otherMappings.push({
        plc_reg_add: normalizedAddress,
        data_type: 'CHANNEL', // Keep original data type
        opcua_reg_add: opcuaName
      });
    } else {
      // Handle other data types - keep original data type names
      const opcuaName = generateOpcuaName(normalizedAddress, item.data_type, undefined, false, plcNumber);
      
      otherMappings.push({
        plc_reg_add: normalizedAddress,
        data_type: item.data_type as AddressMapping['data_type'], // Keep original data type
        opcua_reg_add: opcuaName
      });
    }
  }

  // Create address mappings for grouped boolean addresses
  const addressMappings: AddressMapping[] = [];
  let booleanChannelCount = 0;
  const modifiedChannelAddresses: string[] = [];

  // Process grouped boolean addresses
  for (const [baseAddress, bits] of Array.from(booleanGroups.entries())) {
    if (bits.length > 1) {
      // Only group if there are multiple bits - create a boolean channel
      booleanChannelCount++;
      const opcuaName = generateOpcuaName(baseAddress, 'BOOL', undefined, true, plcNumber);
      
      // Track original addresses that were combined into this boolean channel
      for (const bit of bits) {
        modifiedChannelAddresses.push(bit.originalAddress);
      }
      
      addressMappings.push({
        plc_reg_add: baseAddress,
        data_type: 'BOOL', // Keep original BOOL type for boolean channel
        opcua_reg_add: opcuaName
      });
    } else {
      // Single bit, add as individual mapping
      const bit = bits[0];
      const opcuaName = generateOpcuaName(
        bit.normalizedAddress.split('.')[0],
        'BOOL',
        bit.bitPosition,
        false,
        plcNumber
      );
      
      addressMappings.push({
        plc_reg_add: bit.normalizedAddress,
        data_type: 'BOOL', // Keep original BOOL type
        opcua_reg_add: opcuaName
      });
    }
  }

  // Add other mappings
  addressMappings.push(...otherMappings);

  return {
    addressMappings,
    stats: {
      totalRecords: csvData.length,
      validRecords: addressMappings.length,
      skippedRecords: skippedAddresses.length,
      booleanChannels: booleanChannelCount
    },
    skippedAddresses,
    modifiedChannelAddresses
  };
}