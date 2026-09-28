import { BaseBbiWebPart } from '../../shared/BaseBbiWebPart';
export default class QuickLinksWebPart extends BaseBbiWebPart {
  protected readonly kind = 'links' as const;
}
