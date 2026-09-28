import { BaseBbiWebPart } from '../../shared/BaseBbiWebPart';
export default class HeroWebPart extends BaseBbiWebPart {
  protected readonly kind = 'hero' as const;
}
