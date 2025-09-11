import { useState } from "react";
import { Upload, CloudUpload, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import type { AddressMapping } from "@shared/schema";
import { parseCSVData, type ParseResult } from "@/lib/plc-parser";
// @ts-ignore - encoding-japanese doesn't have TypeScript definitions
import Encoding from "encoding-japanese";

interface FileUploadCardProps {
  onFileProcessed: (mappings: AddressMapping[]) => void;
  onClose?: () => void;
  plcNo?: number;
}

export function FileUploadCard({ onFileProcessed, onClose, plcNo = 1 }: FileUploadCardProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [rawCSVData, setRawCSVData] = useState<string[][]>([]);

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast({
        title: t('fileUploadError'),
        description: 'Please upload a CSV or TXT file',
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setParseResult(null);
    setShowPreview(false);
    setUploadedFileName(file.name);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 100);

    // Read file as ArrayBuffer for proper encoding handling
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Try to detect encoding - similar to Python's encoding detection
        let decodedString = '';
        const encodingsToTry = ['SJIS', 'UTF8', 'EUCJP', 'JIS'];
        
        for (const encoding of encodingsToTry) {
          try {
            const unicodeArray = Encoding.convert(uint8Array, {
              to: 'UNICODE',
              from: encoding
            });
            
            decodedString = Encoding.codeToString(unicodeArray);
            
            // Check if the decoded string contains readable content
            // If it has proper CSV structure, we found the right encoding
            if (decodedString && !decodedString.includes('\ufffd') && decodedString.includes(',')) {
              console.log(`Successfully decoded with encoding: ${encoding}`);
              break;
            }
          } catch (e: unknown) {
            // Continue to next encoding
            continue;
          }
        }
        
        // If no encoding worked, fall back to UTF-8
        if (!decodedString || decodedString.includes('\ufffd')) {
          const decoder = new TextDecoder('utf-8');
          decodedString = decoder.decode(uint8Array);
        }

        // Parse the decoded string with PapaParse
        Papa.parse(decodedString, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            clearInterval(progressInterval);
            setProgress(100);

            try {
              const data = results.data as string[][];
              
              // Store the raw CSV data
              setRawCSVData(data);
              
              // Skip header row if present
              const startIndex = data[0]?.some(cell => 
                cell?.toLowerCase().includes('register') || 
                cell?.toLowerCase().includes('type') ||
                cell?.toLowerCase().includes('address')
              ) ? 1 : 0;

              // Use the new PLC parser with the specified PLC number
              const result = parseCSVData(data.slice(startIndex), plcNo);
              setParseResult(result);
              setShowPreview(true);

              setTimeout(() => {
                setIsUploading(false);
                toast({
                  title: t('fileUploadSuccess'),
                  description: `${result.stats.validRecords} mappings processed, ${result.stats.booleanChannels} boolean channels created`,
                });
              }, 500);

            } catch (error) {
              setProgress(0);
              setIsUploading(false);
              setParseResult(null);
              toast({
                title: t('fileUploadError'),
                description: error instanceof Error ? error.message : 'Unknown error occurred',
                variant: "destructive",
              });
            }
          },
          error: (error: { message: string }) => {
            clearInterval(progressInterval);
            setProgress(0);
            setIsUploading(false);
            toast({
              title: t('fileUploadError'),
              description: error.message,
              variant: "destructive",
            });
          }
        });

      } catch (error) {
        clearInterval(progressInterval);
        setProgress(0);
        setIsUploading(false);
        toast({
          title: t('fileUploadError'),
          description: error instanceof Error ? error.message : 'File encoding detection failed',
          variant: "destructive",
        });
      }
    };

    reader.onerror = function() {
      clearInterval(progressInterval);
      setProgress(0);
      setIsUploading(false);
      toast({
        title: t('fileUploadError'),
        description: 'Failed to read file',
        variant: "destructive",
      });
    };

    // Read the file as ArrayBuffer instead of text
    reader.readAsArrayBuffer(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleImport = () => {
    if (parseResult) {
      onFileProcessed(parseResult.addressMappings);
      setParseResult(null);
      setShowPreview(false);
      toast({
        title: "Import Successful",
        description: `${parseResult.stats.validRecords} address mappings have been imported`,
      });
    }
  };

  const handleUploadAnother = () => {
    setParseResult(null);
    setShowPreview(false);
    setProgress(0);
    setUploadedFileName("");
    setRawCSVData([]);
  };

  return (
    <Card className="mb-6 slide-up" data-testid="card-file-upload">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="w-5 h-5 text-primary" />
          <span data-testid="text-upload-title">{t('uploadTitle')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-muted-foreground mb-2" data-testid="text-upload-description">
            {t('uploadDescription')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="bg-muted p-2 rounded text-center">
              <span className="font-medium" data-testid="text-col1">{t('col1')}</span>
            </div>
            <div className="bg-muted p-2 rounded text-center">
              <span className="font-medium" data-testid="text-col2">{t('col2')}</span>
            </div>
            <div className="bg-muted p-2 rounded text-center">
              <span className="font-medium" data-testid="text-col3">{t('col3')}</span>
            </div>
            <div className="bg-muted p-2 rounded text-center">
              <span className="font-medium" data-testid="text-col4">{t('col4')}</span>
            </div>
          </div>
        </div>
        
        {!parseResult && (
          <div 
            className="upload-zone rounded-lg p-8 text-center cursor-pointer"
            onClick={() => document.getElementById('fileInput')?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            data-testid="zone-file-upload"
          >
            <CloudUpload className="w-16 h-16 text-muted-foreground mb-4 mx-auto" />
            <p className="text-lg font-medium text-foreground mb-2" data-testid="text-upload-main">
              {t('uploadText')}
            </p>
            <p className="text-muted-foreground" data-testid="text-upload-sub">
              {t('uploadSubtext')}
            </p>
            <input 
              type="file" 
              id="fileInput" 
              className="hidden" 
              accept=".csv,.txt"
              onChange={handleFileSelect}
              data-testid="input-file"
            />
          </div>
        )}
        
        {isUploading && (
          <div className="mt-4" data-testid="container-progress">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-foreground" data-testid="text-progress">
                {t('progressText')}
              </span>
              <span className="text-sm text-muted-foreground" data-testid="text-progress-percent">
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="w-full" data-testid="progress-upload" />
          </div>
        )}

        {parseResult && (
          <div className="space-y-4" data-testid="container-preview">
            {/* Filename Display */}
            <div className="bg-primary/10 p-3 rounded-lg border">
              <p className="text-sm font-medium" data-testid="text-uploaded-filename">
                {t('uploadedFile')}: <span className="font-mono">{uploadedFileName}</span>
              </p>
            </div>
            
            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary" data-testid="stat-total">{parseResult.stats.totalRecords}</div>
                <div className="text-sm text-muted-foreground">{t('totalRecords')}</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600" data-testid="stat-valid">{parseResult.stats.validRecords}</div>
                <div className="text-sm text-muted-foreground leading-tight">
                  {language === 'en' ? (
                    <>
                      <div>After Modification</div>
                      <div>Records</div>
                    </>
                  ) : (
                    <>
                      <div>変更後</div>
                      <div>レコード数</div>
                    </>
                  )}
                </div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600" data-testid="stat-skipped">{parseResult.stats.skippedRecords}</div>
                <div className="text-sm text-muted-foreground">{t('skippedRecords')}</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600" data-testid="stat-channels">{parseResult.stats.booleanChannels}</div>
                <div className="text-sm text-muted-foreground">{t('booleanChannels')}</div>
              </div>
            </div>

            {/* Preview Toggle */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                data-testid="button-toggle-preview"
              >
                {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showPreview ? t('hidePreview') : t('showPreview')}
              </Button>
            </div>

            {/* Preview Content */}
            {showPreview && (
              <div className="border rounded-lg p-4 max-h-96 overflow-auto bg-muted/25" data-testid="container-preview-data">
                <h4 className="font-semibold mb-3">{t('previewTitle')}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-2 border border-border text-left font-semibold" data-testid="header-col-0">
                          {t('colNaming')}
                        </th>
                        <th className="p-2 border border-border text-left font-semibold" data-testid="header-col-1">
                          {t('colDataType')}
                        </th>
                        <th className="p-2 border border-border text-left font-semibold" data-testid="header-col-2">
                          {t('colRegisterAddress')}
                        </th>
                        <th className="p-2 border border-border text-left font-semibold" data-testid="header-col-3">
                          {t('colComments')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawCSVData.map((row, rowIndex) => (
                        <tr key={rowIndex} data-testid={`preview-row-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="p-2 border border-border font-mono text-xs" data-testid={`cell-${rowIndex}-${cellIndex}`}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleUploadAnother} data-testid="button-upload-another">
                Upload Another File
              </Button>
              <Button onClick={handleImport} data-testid="button-import-mappings">
                Import {parseResult.stats.validRecords} Mappings
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}