import test from 'node:test';
import assert from 'node:assert/strict';
import {extractGeoJsonGeometry,geometryAreaHa} from '../web/maps/geometry-tools.js';

const polygon={type:'Polygon',coordinates:[[[-47.900,-21.200],[-47.899,-21.200],[-47.899,-21.199],[-47.900,-21.199],[-47.900,-21.200]]]};

test('extracts Polygon from Feature and explicit FeatureCollection index',()=>{
  assert.deepEqual(extractGeoJsonGeometry({type:'Feature',properties:{},geometry:polygon}),polygon);
  const other={...polygon,coordinates:[[[-48,-22],[-47.999,-22],[-47.999,-21.999],[-48,-21.999],[-48,-22]]]};
  assert.deepEqual(extractGeoJsonGeometry({type:'FeatureCollection',features:[{type:'Feature',geometry:polygon},{type:'Feature',geometry:other}]},1),other);
});

test('calculates plausible geodesic area without changing registered pasture area',()=>{
  const area=geometryAreaHa(polygon);assert.ok(area>1&&area<1.3,`area=${area}`);
});

test('rejects non-polygon GeoJSON',()=>{
  assert.throws(()=>extractGeoJsonGeometry({type:'Feature',geometry:{type:'Point',coordinates:[-47,-21]}}),/Polygon/);
});
