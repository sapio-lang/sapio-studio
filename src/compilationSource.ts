import type {
    JsonObject,
    JsonValue,
    ModuleInfo,
    StudioAPI,
} from '../shared/studio';
import type { PatchBuildRecipe } from './patching/PatchCanvas';
import { assertJsonNumbers, runPatch } from './patching/engine';
import { object } from './patching/schema';
import { parseEditorJson } from './patching/schemaValue';
import { extractContract } from './artifactSession';

export type CompilationSource =
    | { kind: 'module'; key: string; args: JsonValue; result: JsonValue }
    | { kind: 'patch'; recipe: PatchBuildRecipe };

export interface ActionOrigin {
    id: string;
    moduleKey: string;
    nodePath?: string[];
    context: JsonValue;
}

export function sameJsonValue(a: JsonValue, b: JsonValue): boolean {
    const pending: [JsonValue, JsonValue][] = [[a, b]];
    while (pending.length) {
        const [left, right] = pending.pop()!;
        if (left === right) continue;
        if (Array.isArray(left) && Array.isArray(right)) {
            if (left.length !== right.length) return false;
            left.forEach((value, index) =>
                pending.push([value, right[index]!]),
            );
        } else if (object(left) && object(right)) {
            const keys = Object.keys(left);
            if (keys.length !== Object.keys(right).length) return false;
            for (const key of keys) {
                if (!Object.hasOwn(right, key)) return false;
                pending.push([left[key]!, right[key]!]);
            }
        } else return false;
    }
    return true;
}

function containsObject(
    value: JsonValue,
    matches: (value: JsonObject) => boolean,
): boolean {
    const pending = [value];
    while (pending.length) {
        const next = pending.pop()!;
        if (Array.isArray(next)) pending.push(...next);
        else if (object(next)) {
            if (matches(next)) return true;
            pending.push(...Object.values(next));
        }
    }
    return false;
}

function advertisesAction(value: JsonObject, path: string): boolean {
    const points = value.continuation_points;
    const point =
        object(points) && Object.hasOwn(points, path)
            ? points[path]
            : undefined;
    return (
        object(point) &&
        point.path === path &&
        (typeof point.schema === 'boolean' || object(point.schema))
    );
}

function invocations(source: CompilationSource) {
    return source.kind === 'module'
        ? [
              {
                  id: 'module',
                  moduleKey: source.key,
                  args: source.args,
                  result: source.result,
                  nodePath: undefined,
              },
          ]
        : source.recipe.trace.map((invocation) => ({
              ...invocation,
              id: JSON.stringify(invocation.nodePath),
          }));
}

function invocationContext(args: JsonValue): JsonValue {
    if (!object(args) || !Object.hasOwn(args, 'context'))
        throw new Error(
            'The original module invocation has no compilation context.',
        );
    return args.context!;
}

/** Matching a returned contract identifies replay candidates, not callback ownership. */
export function findActionOrigins(
    source: CompilationSource,
    compiledChildText: string,
    actionPath: string,
): ActionOrigin[] {
    const child = parseEditorJson(
        extractContract(compiledChildText, ''),
    ) as JsonObject;
    if (!advertisesAction(child, actionPath)) return [];
    return invocations(source)
        .filter((invocation) =>
            containsObject(invocation.result, (value) =>
                sameJsonValue(child, value),
            ),
        )
        .map((invocation) => ({
            id: invocation.id,
            moduleKey: invocation.moduleKey,
            ...(invocation.nodePath
                ? { nodePath: [...invocation.nodePath] }
                : {}),
            context: structuredClone(invocationContext(invocation.args)),
        }));
}

function withRequest(
    context: JsonValue,
    actionPath: string,
    request: JsonValue,
): JsonObject {
    if (!object(context))
        throw new Error('Compilation context must be an object.');
    const result = structuredClone(context);
    const database = Object.hasOwn(result, 'effects') ? result.effects : {};
    if (!object(database))
        throw new Error('Compilation effects must be an object.');
    const effects = Object.hasOwn(database, 'effects') ? database.effects : {};
    if (!object(effects))
        throw new Error('Compilation effect paths must be an object.');
    const requests = Object.hasOwn(effects, actionPath)
        ? effects[actionPath]
        : {};
    if (!object(requests))
        throw new Error('Action requests must be an object.');
    let index = 1;
    let label: string;
    do label = `request_${String(index++).padStart(6, '0')}`;
    while (Object.hasOwn(requests, label));
    requests[label] = structuredClone(request);
    // Computed property creation preserves an own JSON key for any path.
    database.effects = { ...effects, [actionPath]: requests };
    result.effects = database;
    return result;
}

/** Produce a replay plan without changing the saved run or another node's effects. */
export function applyProposal(
    source: CompilationSource,
    originId: string,
    actionPath: string,
    request: JsonValue,
): CompilationSource {
    assertJsonNumbers(request, 'Action request');
    const next = structuredClone(source);
    const invocation = invocations(next).find(
        (candidate) => candidate.id === originId,
    );
    if (
        !invocation ||
        !containsObject(invocation.result, (value) =>
            advertisesAction(value, actionPath),
        )
    )
        throw new Error('The selected module did not return this action.');
    const args = invocation.args;
    if (!object(args))
        throw new Error('The original module invocation must be an object.');
    args.context = withRequest(invocationContext(args), actionPath, request);
    return next;
}

/** Replay the saved inputs, validating every host boundary before returning a new source. */
export async function runCompilation(
    source: CompilationSource,
    api: StudioAPI,
    moduleCatalog?: ModuleInfo[],
): Promise<{ text: string; source: CompilationSource }> {
    const next = structuredClone(source);
    if (next.kind === 'module') {
        assertJsonNumbers(next.args, 'Module arguments');
        const argumentsCheck = await api.modules.validate({
            key: next.key,
            side: 'arguments',
            value: structuredClone(next.args),
        });
        if (!argumentsCheck.valid)
            throw new Error(
                `Invalid module arguments: ${argumentsCheck.errors.join('; ')}`,
            );
        const text = await api.modules.call({
            key: next.key,
            args: JSON.stringify(next.args),
        });
        const result = parseEditorJson(text);
        assertJsonNumbers(result, 'Module result');
        const returnsCheck = await api.modules.validate({
            key: next.key,
            side: 'returns',
            value: structuredClone(result),
        });
        if (!returnsCheck.valid)
            throw new Error(
                `The module result violates its advertised API: ${returnsCheck.errors.join('; ')}`,
            );
        next.result = result;
        return { text, source: next };
    }
    const catalog = moduleCatalog
        ? structuredClone(moduleCatalog)
        : await Promise.all(
              (await api.modules.list()).map((module) =>
                  api.modules.info(module.key),
              ),
          );
    const contexts = new Map(
        next.recipe.trace.map((invocation) => [
            JSON.stringify(invocation.nodePath),
            structuredClone(invocationContext(invocation.args)),
        ]),
    );
    if (contexts.size !== next.recipe.trace.length)
        throw new Error('The saved compilation repeats a module invocation.');
    const completed = await runPatch(
        next.recipe.patch,
        catalog,
        next.recipe.outputNode,
        next.recipe.context,
        {
            contextForNode(nodePath, defaultContext) {
                const key = JSON.stringify(nodePath);
                return structuredClone(
                    contexts.has(key) ? contexts.get(key)! : defaultContext,
                );
            },
            async invoke(key, args) {
                return parseEditorJson(
                    await api.modules.call({ key, args: JSON.stringify(args) }),
                );
            },
            validate(key, side, value) {
                return api.modules.validate({ key, side, value });
            },
            validateValue(schema, value) {
                return api.modules.validateValue({ schema, value });
            },
        },
    );
    next.recipe.trace = completed.trace;
    return { text: JSON.stringify(completed.output, null, 2), source: next };
}
