import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/**
 * Going from one fight straight to the next (e.g. "Nächster Gegner") only changes
 * the query string. Rebuild the fight page then, instead of reusing the old one.
 */
export class FightReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === current.routeConfig && future.routeConfig?.path !== 'fight';
  }
}
