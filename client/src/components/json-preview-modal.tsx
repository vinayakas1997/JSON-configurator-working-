import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/use-language";

interface JsonPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  jsonContent: string;
}

export function JsonPreviewModal({ isOpen, onClose, jsonContent }: JsonPreviewModalProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-96 flex flex-col" data-testid="modal-json-preview">
        <DialogHeader>
          <DialogTitle data-testid="text-json-modal-title">{t('jsonModalTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <pre 
            className="bg-muted p-4 rounded text-sm overflow-auto font-mono"
            data-testid="text-json-content"
          >
            {jsonContent}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
