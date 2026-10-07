import './interactions.css';
import type { InteractionProps } from '../types';
import { RegionalMapDiscovery } from '../regional-map/RegionalMapDiscovery';
import { WorldInteraction as GenericSceneInteraction } from './panel';
/** Different component identities keep each hook contract independent. */
export function WorldInteraction(props: InteractionProps) {
  return props.sceneId === 'planning-museum'
    ? <RegionalMapDiscovery values={props.values} onChange={props.onChange}/>
    : <GenericSceneInteraction {...props}/>;
}
