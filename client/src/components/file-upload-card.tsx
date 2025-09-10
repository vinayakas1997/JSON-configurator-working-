import { useState } from "react";
import { Upload, CloudUpload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import type { AddressMapping } from "@shared/schema";

interface FileUploadCardProps {
  onFileProcessed: (mappings: AddressMapping[]) => void;
  onClose: () => void;
}

export function FileUploadCard({ onFileProcessed, onClose }: FileUploadCardProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast({
        title: t('fileUploadError'),
        description: t('invalidFileFormat'),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        clearInterval(progressInterval);
        setProgress(100);

        try {
          const data = results.data as string[][];
          
          // Skip header row if present
          const startIndex = data[0]?.some(cell => 
            cell?.toLowerCase().includes('register') || 
            cell?.toLowerCase().includes('type') ||
            cell?.toLowerCase().includes('address')
          ) ? 1 : 0;

          const mappings: AddressMapping[] = data.slice(startIndex).map((row, index) => {
            if (row.length < 3) {
              throw new Error(`Row ${index + startIndex + 1} has insufficient columns`);
            }

            const dataType = row[1]?.toLowerCase();
            const validDataTypes = ['int16', 'int32', 'float32', 'bool', 'string'];
            const normalizedDataType = validDataTypes.includes(dataType) ? dataType : 'int16';

            return {
              plc_reg_add: row[0]?.trim() || '',
              data_type: normalizedDataType as AddressMapping['data_type'],
              opcua_reg_add: row[2]?.trim() || ''
            };
          }).filter(mapping => mapping.plc_reg_add && mapping.opcua_reg_add);

          setTimeout(() => {
            onFileProcessed(mappings);
            toast({
              title: t('fileUploadSuccess'),
              description: `${mappings.length} mappings imported`,
            });
            onClose();
          }, 500);

        } catch (error) {
          setProgress(0);
          setIsUploading(false);
          toast({
            title: t('fileUploadError'),
            description: error instanceof Error ? error.message : 'Unknown error occurred',
            variant: "destructive",
          });
        }
      },
      error: (error) => {
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
      </CardContent>
    </Card>
  );
}
