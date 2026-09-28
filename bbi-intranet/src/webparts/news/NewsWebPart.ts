import { BaseBbiWebPart } from '../../shared/BaseBbiWebPart';
export default class NewsWebPart extends BaseBbiWebPart {
  protected readonly kind = 'news' as const;
}
