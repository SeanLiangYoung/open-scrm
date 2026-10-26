import {describe,it,expect,vi} from 'vitest';
import { GenerationService } from './generation.service';
import { ContentSourceService } from './content-source.service';
function setup(sourceId:unknown){const s=new GenerationService();s.contentSourceService={getSource:vi.fn().mockResolvedValue({id:10,corpId:1})} as any;s.getVariant=vi.fn().mockResolvedValue({id:'3',corpId:'1',sourceId}) as any;s.pushVariantDraft=vi.fn().mockResolvedValue({contentId:17}) as any;return s;}
const batch=(s:GenerationService)=>s.batchPushDrafts(1,10,{items:[{variantId:3,platform:'x',accountId:1,contentType:1}]},{});
describe('Studio exact bigint source ownership',()=>{
 it.each([10,'10'])('same source hydrated %s accepted',async sourceId=>{const s=setup(sourceId);expect(await batch(s)).toEqual([{variantId:3,success:true,contentId:17}]);expect(s.pushVariantDraft).toHaveBeenCalledTimes(1)});
 it.each(['11','010','1e1',true,[],9007199254740992,'9223372036854775808'])('different or ambiguous hydrated source %j never pushed',async sourceId=>{const s=setup(sourceId);expect((await batch(s))[0].success).toBe(false);expect(s.pushVariantDraft).not.toHaveBeenCalled()});
 it.each([0,-1,1.5,Number.MAX_SAFE_INTEGER+1])('source direct invalid %s rejected before repository',async id=>{const s=new ContentSourceService();const findOne=vi.fn();s.sourceRepository={findOne} as any;await expect(s.getSource(1,id)).rejects.toMatchObject({status:400});expect(findOne).not.toHaveBeenCalled()});
 it('variant lookup retains tenant filter',async()=>{const s=new GenerationService();const findOne=vi.fn().mockResolvedValue(null);s.variantRepository={findOne} as any;await expect(s.getVariant(1,3)).rejects.toThrow();expect(findOne).toHaveBeenCalledWith({where:{corpId:1,id:3}})});
});
