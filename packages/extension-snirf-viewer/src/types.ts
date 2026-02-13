export interface SnirfProbe {
  wavelengths?: number[];
  wavelengthsEmission?: number[];
  sourcePos2D?: number[][];
  sourcePos3D?: number[][];
  detectorPos2D?: number[][];
  detectorPos3D?: number[][];
  sourceLabels?: string[][];
  detectorLabels?: string[];
}

export interface SnirfMeasurement {
  sourceIndex: number;
  detectorIndex: number;
  wavelengthIndex: number;
  dataType: number;
  dataTypeIndex: number;
}

export interface SnirfDataBlock {
  dataTimeSeries: number[][];
  time: number[];
  measurementList: SnirfMeasurement[];
}

export interface SnirfNirs {
  metaDataTags?: Record<string, string | number>;
  data: SnirfDataBlock[];
  probe?: SnirfProbe;
}

export interface SnirfData {
  formatVersion?: string;
  nirs: SnirfNirs[];
}
