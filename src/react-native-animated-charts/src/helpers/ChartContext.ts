import React from 'react';
import Animated from 'react-native-reanimated';
import * as redash from 'react-native-redash';

export const enum CurveType {
  basis = 'basis',
  bump = 'bump',
  linear = 'linear',
  monotone = 'monotone',
  natural = 'natural',
  step = 'step',
}

export interface Point {
  x: number;
  y: number;
}

export interface DataType {
  points: Point[];
  curve?: CurveType;
}

export type CallbackType = {
  data: DataType;
  width: number;
  height: number;
};

export interface PathData {
  path: string;
  parsed: null | redash.Path;
  points: Point[];
  data: Point[];
}

export interface ScalesFunctions {
  scaleX: (value: number) => number;
  scaleY: (value: number) => number;
}

export interface ChartData {
  data: DataType;
  width: number;
  height: number;
  progress: Animated.SharedValue<number>;
  dotScale: Animated.SharedValue<number>;
  originalX: Animated.SharedValue<string>;
  originalY: Animated.SharedValue<string>;
  pathOpacity: Animated.SharedValue<number>;
  state: Animated.SharedValue<number>;
  isActive: Animated.SharedValue<boolean>;
  positionX: Animated.SharedValue<number>;
  positionY: Animated.SharedValue<number>;
  paths: [PathData, PathData];
  currentPath: PathData;
}

export const ChartContext = React.createContext<ChartData | null>(null);