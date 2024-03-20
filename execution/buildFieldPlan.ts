import { getBySet } from '../jsutils/getBySet.ts';
import { isSameSet } from '../jsutils/isSameSet.ts';
import type { DeferUsage, FieldDetails } from './collectFields.ts';
export type DeferUsageSet = ReadonlySet<DeferUsage>;
export interface FieldGroup {
  fields: ReadonlyArray<FieldDetails>;
  deferUsages?: DeferUsageSet | undefined;
}
export type GroupedFieldSet = Map<string, FieldGroup>;
export interface NewGroupedFieldSetDetails {
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
}
export function buildFieldPlan(
  fields: Map<string, ReadonlyArray<FieldDetails>>,
  parentDeferUsages: DeferUsageSet = new Set<DeferUsage>(),
): {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetailsMap: Map<DeferUsageSet, NewGroupedFieldSetDetails>;
} {
  const groupedFieldSet = new Map<
    string,
    {
      fields: Array<FieldDetails>;
      deferUsages: DeferUsageSet;
    }
  >();
  const newGroupedFieldSetDetailsMap = new Map<
    DeferUsageSet,
    {
      groupedFieldSet: Map<
        string,
        {
          fields: Array<FieldDetails>;
          deferUsages: DeferUsageSet;
        }
      >;
      shouldInitiateDefer: boolean;
    }
  >();
  const map = new Map<
    string,
    {
      deferUsageSet: DeferUsageSet;
      fieldDetailsList: ReadonlyArray<FieldDetails>;
    }
  >();
  for (const [responseKey, fieldDetailsList] of fields) {
    const deferUsageSet = new Set<DeferUsage>();
    let inOriginalResult = false;
    for (const fieldDetails of fieldDetailsList) {
      const deferUsage = fieldDetails.deferUsage;
      if (deferUsage === undefined) {
        inOriginalResult = true;
        continue;
      }
      deferUsageSet.add(deferUsage);
    }
    if (inOriginalResult) {
      deferUsageSet.clear();
    } else {
      deferUsageSet.forEach((deferUsage) => {
        const ancestors = getAncestors(deferUsage);
        for (const ancestor of ancestors) {
          if (deferUsageSet.has(ancestor)) {
            deferUsageSet.delete(deferUsage);
          }
        }
      });
    }
    map.set(responseKey, { deferUsageSet, fieldDetailsList });
  }
  for (const [responseKey, { deferUsageSet, fieldDetailsList }] of map) {
    if (isSameSet(deferUsageSet, parentDeferUsages)) {
      let fieldGroup = groupedFieldSet.get(responseKey);
      if (fieldGroup === undefined) {
        fieldGroup = {
          fields: [],
          deferUsages: deferUsageSet,
        };
        groupedFieldSet.set(responseKey, fieldGroup);
      }
      fieldGroup.fields.push(...fieldDetailsList);
      continue;
    }
    let newGroupedFieldSetDetails = getBySet(
      newGroupedFieldSetDetailsMap,
      deferUsageSet,
    );
    let newGroupedFieldSet;
    if (newGroupedFieldSetDetails === undefined) {
      newGroupedFieldSet = new Map<
        string,
        {
          fields: Array<FieldDetails>;
          deferUsages: DeferUsageSet;
          knownDeferUsages: DeferUsageSet;
        }
      >();
      newGroupedFieldSetDetails = {
        groupedFieldSet: newGroupedFieldSet,
        shouldInitiateDefer: Array.from(deferUsageSet).some(
          (deferUsage) => !parentDeferUsages.has(deferUsage),
        ),
      };
      newGroupedFieldSetDetailsMap.set(
        deferUsageSet,
        newGroupedFieldSetDetails,
      );
    } else {
      newGroupedFieldSet = newGroupedFieldSetDetails.groupedFieldSet;
    }
    let fieldGroup = newGroupedFieldSet.get(responseKey);
    if (fieldGroup === undefined) {
      fieldGroup = {
        fields: [],
        deferUsages: deferUsageSet,
      };
      newGroupedFieldSet.set(responseKey, fieldGroup);
    }
    fieldGroup.fields.push(...fieldDetailsList);
  }
  return {
    groupedFieldSet,
    newGroupedFieldSetDetailsMap,
  };
}
function getAncestors(deferUsage: DeferUsage): ReadonlyArray<DeferUsage> {
  const ancestors: Array<DeferUsage> = [];
  let parentDeferUsage: DeferUsage | undefined = deferUsage.parentDeferUsage;
  while (parentDeferUsage !== undefined) {
    ancestors.unshift(parentDeferUsage);
    parentDeferUsage = parentDeferUsage.parentDeferUsage;
  }
  return ancestors;
}
