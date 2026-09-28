import { BaseBbiWebPart } from '../../shared/BaseBbiWebPart';
export default class DirectoryWebPart extends BaseBbiWebPart {
  protected readonly kind = 'directory' as const;
}
