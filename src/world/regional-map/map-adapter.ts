import { hkSzMap, gbaMap } from './map-data';
import { cityTimeline } from './timeline-data';

export type MapValues = Readonly<Record<string, string | number | boolean | null>>;
export type MapRegion = 'hk-sz' | 'gba';
export type MapPoint = { readonly id: string; readonly name: string; readonly xy: readonly number[]; readonly kind: string; readonly source: string; readonly accuracy?: string };
export type GeographicMap = { readonly id: string; readonly viewBox: readonly number[]; readonly land: readonly { readonly region: string; readonly rings: readonly (readonly (readonly number[])[])[] }[]; readonly coastlines: readonly (readonly (readonly number[])[])[]; readonly landRiverBoundary: readonly (readonly number[])[]; readonly points: readonly MapPoint[] };
export const stageDates = ['1980s', '1996–2004', '2010', '2024/25'] as const;
export const stageDefaultPlaces = ['luohu', 'futian', 'qianhai', 'nanshan'] as const;

/** Read and update only our namespaced keys; preserve the caller's other interaction data. */
export function mapSelection(values: MapValues) {
  const region: MapRegion = values.mapRegion === 'gba' ? 'gba' : 'hk-sz';
  const index = cityTimeline.stages.findIndex(stage => stage.id === values.mapChapter);
  const stageIndex = index < 0 ? 0 : index;
  const stage = cityTimeline.stages[stageIndex];
  const map: GeographicMap = region === 'gba' ? gbaMap : hkSzMap;
  const defaultPlace = region === 'gba' ? 'hong-kong' : stageDefaultPlaces[stageIndex];
  const stored = region === 'gba' ? values.mapGbaPlace : values.mapLocalPlace;
  const point = map.points.find(item => item.id === stored) ?? map.points.find(item => item.id === defaultPlace)!;
  return { region, stage, stageIndex, map, point };
}

export function selectRegion(values: MapValues, region: MapRegion): MapValues {
  return { ...values, mapRegion: region };
}

export function selectStage(values: MapValues, index: number): MapValues {
  const safeIndex = Math.max(0, Math.min(cityTimeline.stages.length - 1, Math.trunc(Number.isFinite(index) ? index : 0)));
  return { ...values, mapRegion: 'hk-sz', mapChapter: cityTimeline.stages[safeIndex].id, mapLocalPlace: stageDefaultPlaces[safeIndex] };
}

export function selectPlace(values: MapValues, id: string): MapValues {
  const selection = mapSelection(values);
  if (!selection.map.points.some(point => point.id === id)) return values;
  return { ...values, [selection.region === 'gba' ? 'mapGbaPlace' : 'mapLocalPlace']: id };
}

/** Coordinates are source fractions, never hand-positioned geographical points. */
export function linePath(points: readonly (readonly number[])[], viewBox: readonly number[]): string {
  return points.map((point, index) => `${index ? 'L' : 'M'}${(point[0] * viewBox[2]).toFixed(3)},${(point[1] * viewBox[3]).toFixed(3)}`).join(' ');
}

export function polygonPath(rings: readonly (readonly (readonly number[])[])[], viewBox: readonly number[]): string {
  return rings.map(ring => `${linePath(ring, viewBox)} Z`).join(' ');
}

export const regionalInsight = 'Hong Kong and Shenzhen sit east of the Pearl River estuary; Macao and Zhuhai lie to the west. Guangzhou lies farther north. Choose a city to locate it.';
export const cityOrder = ['hong-kong', 'shenzhen', 'dongguan', 'guangzhou', 'foshan', 'zhaoqing', 'jiangmen', 'zhongshan', 'zhuhai', 'macau', 'huizhou'];

export const sourceTitles: Readonly<Record<string, string>> = {
  'https://www.szdag.gov.cn/dawh/tqssn/content/post_98517.html': 'Shenzhen Archives · establishment of the SEZ',
  'https://ka.sz.gov.cn/gkmlpt/content/8/8914/post_8914184.html': 'Shenzhen Port Office · Luohu gateway history',
  'https://www.sz.gov.cn/zfgb/1996/gb1996/content/post_10134183.html': 'Shenzhen Government Gazette · 1996 central-area plan',
  'https://mobile.shenzhenmuseum.com/motalDetial?clazzName=CmsInformation&resId=db1ab9300ea746fdb737c9ca1a4d8600': 'Shenzhen Museum · Civic Centre opening record',
  'https://qh.sz.gov.cn/gkmlpt/content/11/11063/post_11063234.html': 'Qianhai Authority · cooperation plan history',
  'https://www.sz.gov.cn/cn/xxgk/zfxxgj/ghjh/csgh/zt/content/post_12013111.html': 'Shenzhen Government · adopted 2021–2035 spatial plan',
  'https://www.sz.gov.cn/szstory/202212/content/mpost_10340606.html': 'Shenzhen Government · citywide SEZ expansion',
  'https://app.www.gov.cn/govdata/gov/201801/15/419496/article.html': 'State Council · abolition of the internal management line',
};
