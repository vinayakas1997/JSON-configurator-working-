import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import type { AddressMapping } from "@shared/schema";

interface AddressMappingsTableProps {
  mappings: AddressMapping[];
  onMappingsChange: (mappings: AddressMapping[]) => void;
}

export function AddressMappingsTable({ mappings, onMappingsChange }: AddressMappingsTableProps) {
  const { t } = useLanguage();

  const addMapping = () => {
    const newMapping: AddressMapping = {
      plc_reg_add: "",
      data_type: "int16",
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
            {mappings.map((mapping, index) => (
              <tr key={index} className="table-row border-t border-border fade-in" data-testid={`row-mapping-${index}`}>
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
            ))}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground" data-testid="text-no-mappings">
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
