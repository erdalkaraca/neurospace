import * as hdf5 from 'jsfive';
import type { SnirfData, SnirfNirs, SnirfDataBlock, SnirfProbe, SnirfMeasurement } from './types.js';

function toArray(value: unknown): number[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flat().map(Number);
  if (value instanceof Float64Array || value instanceof Float32Array)
    return Array.from(value);
  if (value instanceof Int32Array || value instanceof Uint32Array)
    return Array.from(value).map(Number);
  if (typeof value === 'number') return [value];
  return [];
}

function to2DArray(value: unknown, shape?: number[]): number[][] {
  const flat = toArray(value);
  if (flat.length === 0) return [];
  if (shape && shape.length >= 2) {
    const [dim0, dim1] = shape;
    const result: number[][] = [];
    if (dim0 <= 4 && dim1 > dim0) {
      for (let c = 0; c < dim1; c++) {
        const row: number[] = [];
        for (let r = 0; r < dim0; r++) row.push(flat[r * dim1 + c]);
        result.push(row);
      }
      return result;
    }
    for (let r = 0; r < dim0; r++) {
      result.push(flat.slice(r * dim1, (r + 1) * dim1));
    }
    return result;
  }
  return [flat];
}

function safeGet<T>(file: hdf5.File, path: string): T | undefined {
  try {
    return file.get(path) as T;
  } catch {
    return undefined;
  }
}

function toStringArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) =>
      typeof v === 'string' ? v : Array.isArray(v) ? v.map(String) : []
    );
  }
  if (typeof value === 'string') return [value];
  return [];
}

function getKeys(obj: { keys?: string[] }): string[] {
  return obj.keys ?? [];
}

function findNirsPaths(file: hdf5.File): string[] {
  const keys = getKeys(file);
  const nirsKeys = keys.filter((k) => k === 'nirs' || /^nirs\d+$/.test(k));
  return nirsKeys.sort((a, b) => {
    const numA = a === 'nirs' ? 1 : parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = b === 'nirs' ? 1 : parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
}

function findDataPaths(nirsGroup: hdf5.Group): string[] {
  const keys = getKeys(nirsGroup);
  const dataKeys = keys.filter((k) => k === 'data' || /^data\d+$/.test(k));
  if (dataKeys.length === 0) return [];
  return dataKeys.sort((a, b) => {
    const numA = a === 'data' ? 1 : parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = b === 'data' ? 1 : parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
}

function findMeasurementPaths(dataGroup: hdf5.Group): string[] {
  const keys = getKeys(dataGroup);
  const mlKeys = keys.filter(
    (k) => k === 'measurementList' || /^measurementList\d+$/.test(k)
  );
  return mlKeys.sort((a, b) => {
    const numA = a === 'measurementList' ? 1 : parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = b === 'measurementList' ? 1 : parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
}

function readScalar(obj: { value?: unknown } | undefined): number {
  if (!obj?.value) return 0;
  const v = obj.value;
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v.length > 0) return Number(v[0]);
  if (v instanceof Float64Array || v instanceof Float32Array) return v[0] ?? 0;
  if (v instanceof Int32Array || v instanceof Uint32Array) return v[0] ?? 0;
  return 0;
}

function readMeasurementList(
  file: hdf5.File,
  fullPath: string
): SnirfMeasurement {
  const src = safeGet<{ value?: unknown }>(file, `${fullPath}/sourceIndex`);
  const det = safeGet<{ value?: unknown }>(file, `${fullPath}/detectorIndex`);
  const wl = safeGet<{ value?: unknown }>(file, `${fullPath}/wavelengthIndex`);
  const dt = safeGet<{ value?: unknown }>(file, `${fullPath}/dataType`);
  const dti = safeGet<{ value?: unknown }>(file, `${fullPath}/dataTypeIndex`);
  return {
    sourceIndex: readScalar(src),
    detectorIndex: readScalar(det),
    wavelengthIndex: readScalar(wl),
    dataType: readScalar(dt),
    dataTypeIndex: readScalar(dti),
  };
}

function readMeasurementLists(file: hdf5.File, basePath: string): SnirfMeasurement[] {
  const prefix = `${basePath}/measurementLists`;
  const srcIdx = (safeGet(file, `${prefix}/sourceIndex`) as { value?: unknown })?.value;
  const detIdx = (safeGet(file, `${prefix}/detectorIndex`) as { value?: unknown })?.value;
  const wlIdx = (safeGet(file, `${prefix}/wavelengthIndex`) as { value?: unknown })?.value;
  const dt = (safeGet(file, `${prefix}/dataType`) as { value?: unknown })?.value;
  const dti = (safeGet(file, `${prefix}/dataTypeIndex`) as { value?: unknown })?.value;

  const sourceIndices = toArray(srcIdx);
  const detectorIndices = toArray(detIdx);
  const wavelengthIndices = toArray(wlIdx);
  const dataTypes = toArray(dt);
  const dataTypeIndices = toArray(dti);

  const n = Math.max(
    sourceIndices.length,
    detectorIndices.length,
    wavelengthIndices.length
  );
  const list: SnirfMeasurement[] = [];
  for (let i = 0; i < n; i++) {
    list.push({
      sourceIndex: sourceIndices[i] ?? 0,
      detectorIndex: detectorIndices[i] ?? 0,
      wavelengthIndex: wavelengthIndices[i] ?? 0,
      dataType: dataTypes[i] ?? 0,
      dataTypeIndex: dataTypeIndices[i] ?? 0,
    });
  }
  return list;
}

function readDataBlock(file: hdf5.File, basePath: string): SnirfDataBlock | null {
  const dts = safeGet<{ value?: unknown; shape?: number[] }>(file, `${basePath}/dataTimeSeries`);
  const time = safeGet<{ value?: unknown }>(file, `${basePath}/time`);
  if (!dts?.value) return null;

  const dataTimeSeries = to2DArray(dts.value, dts.shape);
  let timeArr = toArray(time?.value);
  if (timeArr.length === 2 && dataTimeSeries.length > 0) {
    const [start, spacing] = timeArr;
    const nSamples = dataTimeSeries.length;
    timeArr = Array.from({ length: nSamples }, (_, i) => start + i * spacing);
  }

  let measurementList: SnirfMeasurement[] = [];
  const measurementLists = safeGet<hdf5.Group>(file, `${basePath}/measurementLists`);
  if (measurementLists) {
    measurementList = readMeasurementLists(file, basePath);
  } else {
    try {
      const dataGroup = file.get(basePath) as hdf5.Group;
      const mlPaths = findMeasurementPaths(dataGroup);
      measurementList = mlPaths.map((p) =>
        readMeasurementList(file, `${basePath}/${p}`)
      );
    } catch {
      measurementList = [];
    }
  }

  return {
    dataTimeSeries,
    time: timeArr,
    measurementList,
  };
}

function readProbe(file: hdf5.File, nirsPath: string): SnirfProbe | undefined {
  const probePaths = [
    `${nirsPath}/probe`,
    `${nirsPath}/probe0`,
    `${nirsPath}/probe1`,
    `${nirsPath}/Probe`,
  ];
  let basePath: string | undefined;
  for (const p of probePaths) {
    const obj = safeGet(file, p);
    if (obj !== undefined && obj !== null) {
      basePath = p;
      break;
    }
  }
  if (!basePath) {
    try {
      const nirsGroup = file.get(nirsPath) as hdf5.Group & { keys?: string[] };
      const keys = nirsGroup.keys ?? [];
      const probeKey = keys.find((k) => /^probe\d*$/i.test(k));
      if (probeKey) basePath = `${nirsPath}/${probeKey}`;
    } catch {
      /* nirs group not found */
    }
  }
  if (!basePath) return undefined;
  const getDataset = (path: string) => {
    const d = safeGet<{ value?: unknown; shape?: number[] }>(file, `${basePath}/${path}`);
    if (d?.value === undefined) return undefined;
    const arr = to2DArray(d.value, d.shape);
    return arr.length > 0 ? arr : undefined;
  };
  const get1D = (path: string) => {
    const d = safeGet<{ value?: unknown }>(file, `${basePath}/${path}`);
    return d?.value !== undefined ? toArray(d.value) : undefined;
  };
  const getStrings = (path: string) => {
    const d = safeGet<{ value?: unknown; shape?: number[] }>(file, `${basePath}/${path}`);
    if (d?.value === undefined) return undefined;
    const arr = toStringArray(d.value);
    return arr.length > 0 ? arr : undefined;
  };
  const getString2D = (path: string) => {
    const d = safeGet<{ value?: unknown; shape?: number[] }>(file, `${basePath}/${path}`);
    if (d?.value === undefined) return undefined;
    const flat = toStringArray(d.value);
    if (flat.length === 0) return undefined;
    const shape = d.shape;
    if (shape && shape.length >= 2) {
      const [rows, cols] = shape;
      const result: string[][] = [];
      for (let r = 0; r < rows; r++)
        result.push(flat.slice(r * cols, (r + 1) * cols));
      return result.length > 0 ? result : undefined;
    }
    return [flat];
  };

  return {
    wavelengths: get1D('wavelengths'),
    wavelengthsEmission: get1D('wavelengthsEmission'),
    sourcePos2D: getDataset('sourcePos2D'),
    sourcePos3D: getDataset('sourcePos3D'),
    detectorPos2D: getDataset('detectorPos2D'),
    detectorPos3D: getDataset('detectorPos3D'),
    sourceLabels: getString2D('sourceLabels'),
    detectorLabels: getStrings('detectorLabels'),
  };
}

export async function loadSnirf(buffer: ArrayBuffer): Promise<SnirfData> {
  try {
    const file = new hdf5.File(buffer, 'snirf');
    const result: SnirfData = { nirs: [] };

    const formatVersion = safeGet<{ value?: string }>(file, 'formatVersion');
    if (formatVersion?.value) {
      result.formatVersion =
        typeof formatVersion.value === 'string'
          ? formatVersion.value
          : String(formatVersion.value);
    }

    const nirsPaths = findNirsPaths(file);
    for (const nirsPath of nirsPaths) {
      const nirsGroup = file.get(nirsPath) as hdf5.Group;
      const dataPaths = findDataPaths(nirsGroup);
      const dataBlocks: SnirfDataBlock[] = [];

      for (const dp of dataPaths) {
        const fullPath = `${nirsPath}/${dp}`;
        const block = readDataBlock(file, fullPath);
        if (block) dataBlocks.push(block);
      }

      const probe = readProbe(file, nirsPath);
      result.nirs.push({
        data: dataBlocks,
        probe,
      });
    }

    return result;
  } catch (e) {
    throw new Error(
      `Failed to parse SNIRF file: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
