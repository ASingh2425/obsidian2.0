declare module 'react-simple-maps' {
  import * as React from 'react';

  export type GeoObject = {
    rsmKey: string;
    properties?: Record<string, unknown>;
    [key: string]: unknown;
  };

  export type GeographiesRenderProps = {
    geographies: GeoObject[];
  };

  export const ComposableMap: React.ComponentType<any>;
  export const Geographies: React.ComponentType<{
    geography: string;
    children?: (props: GeographiesRenderProps) => React.ReactNode;
  }>;
  export const Geography: React.ComponentType<any>;
  export const Marker: React.ComponentType<any>;
  export const Line: React.ComponentType<any>;
}
