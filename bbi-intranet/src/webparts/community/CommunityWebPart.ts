import { BaseBbiWebPart } from '../../shared/BaseBbiWebPart';
export default class CommunityWebPart extends BaseBbiWebPart {
  protected readonly kind = 'community' as const;
}
