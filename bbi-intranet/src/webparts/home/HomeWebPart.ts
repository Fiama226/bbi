import { BaseBbiWebPart } from '../../shared/BaseBbiWebPart';
export default class HomeWebPart extends BaseBbiWebPart {
  protected readonly kind = 'home' as const;
}
