import './interactions.css';
import type { InteractionProps } from '../types';
import { RegionalMapDiscovery } from '../regional-map/RegionalMapDiscovery';
import { WorldInteraction as GenericSceneInteraction } from './panel';
import { HomeDecision, ParcelDecision, RentalDecision } from '../decisions';
/** Different component identities keep each hook contract independent. */
export function WorldInteraction(props: InteractionProps) {
  if (props.sceneId === 'hk-home') return <HomeDecision {...props}/>;
  if (props.sceneId === 'parcel-counter') return <ParcelDecision {...props}/>;
  if (props.sceneId === 'rental-home') return <RentalDecision {...props}/>;
  return props.sceneId === 'planning-museum'
    ? <RegionalMapDiscovery values={props.values} onChange={props.onChange}/>
    : <GenericSceneInteraction {...props}/>;
}
