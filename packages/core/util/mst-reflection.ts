/* eslint-disable no-underscore-dangle */
import {
  isOptionalType,
  isUnionType,
  isArrayType,
  isMapType,
  isLateType,
  IAnyType,
} from 'mobx-state-tree'

/**
 * get the inner type of an MST optional, array, or late type object
 */
export function getSubType(type: IAnyType): IAnyType {
  let t
  if (isOptionalType(type)) {
    // @ts-ignore
    t = type._subtype || type.type
  } else if (isArrayType(type) || isMapType(type)) {
    // @ts-ignore
    t = type._subtype || type._subType || type.subType
    // @ts-ignore
  } else if (typeof type.getSubType === 'function') {
    // @ts-ignore
    return type.getSubType()
  } else {
    throw new TypeError('unsupported mst type')
  }
  if (!t) {
    // debugger
    throw new Error('failed to get subtype')
  }
  return t
}

/**
 * get the array of the subtypes in a union
 */
export function getUnionSubTypes(unionType: IAnyType): IAnyType[] {
  if (!isUnionType(unionType)) {
    throw new TypeError('not an MST union type')
  }
  const t =
    // @ts-ignore
    unionType._types ||
    // @ts-ignore
    unionType.types ||
    // @ts-ignore
    getSubType(unionType)._types ||
    // @ts-ignore
    getSubType(unionType).types
  if (!t) {
    // debugger
    throw new Error('failed to extract subtypes from mst union')
  }
  return t
}

/**
 * get the type of one of the properties of the given MST model type
 */
export function getPropertyType(type: IAnyType, propertyName: string) {
  // @ts-ignore
  const propertyType = type.properties[propertyName]
  return propertyType
}

/**
 * get the base type from inside an MST optional type
 */
export function getDefaultValue(type: IAnyType) {
  if (!isOptionalType(type)) {
    throw new TypeError('type must be an optional type')
  }
  // @ts-ignore
  return type._defaultValue || type.defaultValue
}

/** get the string values of an MST enumeration type */
export function getEnumerationValues(type: IAnyType) {
  const subtypes = getUnionSubTypes(type) as unknown as { value: unknown }[]
  // the subtypes should all be literals with a value member
  return subtypes.map(t => t.value)
}

export function resolveLateType(maybeLate: IAnyType) {
  if (
    !isUnionType(maybeLate) &&
    !isArrayType(maybeLate) &&
    isLateType(maybeLate)
  ) {
    // @ts-ignore
    return maybeLate.getSubType()
  }
  return maybeLate
}