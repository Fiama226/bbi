import { BaseBbiWebPart } from '../../shared/BaseBbiWebPart';
export default class SessionsWebPart extends BaseBbiWebPart {
  protected readonly kind = 'sessions' as const;
}
