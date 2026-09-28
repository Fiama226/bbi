import { BaseBbiWebPart } from '../../shared/BaseBbiWebPart';
export default class SecureDocumentsWebPart extends BaseBbiWebPart {
  protected readonly kind = 'documents' as const;
}
