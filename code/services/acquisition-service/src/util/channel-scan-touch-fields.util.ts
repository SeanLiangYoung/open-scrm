import type { IngestChannelScanDto } from '../dto/channel-code.dto';

/** 是否需在 channel_scan_touch 落一条归因占位记录 */
export function hasAttributionFields(dto: IngestChannelScanDto): boolean {
  return !!(
    dto.utm_campaign?.trim() ||
    dto.creative_id?.trim() ||
    dto.region_pack_id?.trim() ||
    dto.utm_source?.trim() ||
    dto.utm_medium?.trim()
  );
}
