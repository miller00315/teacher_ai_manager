import type { BNCCItem } from '../types';

/** Texto principal da habilidade/descrição (schema normalizado ou legado). */
export function getBnccSkillText(bncc: BNCCItem | null | undefined): string {
    if (!bncc) return '';
    const legacy = bncc.descricao_habilidade?.trim();
    if (legacy) return legacy;
    const ss = bncc.specific_skills;
    return (ss?.description?.trim() || ss?.name?.trim() || '');
}

export function getBnccComponentText(bncc: BNCCItem | null | undefined): string {
    if (!bncc) return '';
    const legacy = bncc.componente_curricular?.trim();
    if (legacy) return legacy;
    return bncc.curriculum_component?.name?.trim() || '';
}

export function getBnccDisciplineRefText(bncc: BNCCItem | null | undefined): string {
    return bncc?.discipline_reference?.name?.trim() || '';
}

/** Etapa de ensino: schema novo (`teaching_stage`) ou legado (`ano_serie`). */
export function getBnccTeachingStageText(bncc: BNCCItem | null | undefined): string {
    if (!bncc) return '';
    const legacy = bncc.ano_serie?.trim();
    if (legacy) return legacy;
    return bncc.teaching_stage?.name?.trim() || '';
}

export function getBnccHabilityAxisText(bncc: BNCCItem | null | undefined): string {
    return bncc?.specific_skills?.habilities?.name?.trim() || '';
}

export function getBnccUnidadeTematica(bncc: BNCCItem | null | undefined): string {
    return bncc?.unidade_tematica?.trim() || '';
}

/** Rótulo para `<select>` / filtros (código + resumo truncado). */
export function bnccSelectOptionLabel(bncc: BNCCItem, maxSkillLen = 60): string {
    const code = bncc.codigo_alfanumerico || '—';
    const skill = getBnccSkillText(bncc);
    const comp = getBnccComponentText(bncc);
    const extra = skill || comp || bncc.id;
    const truncated = extra.length > maxSkillLen ? `${extra.slice(0, maxSkillLen)}…` : extra;
    return `${code} – ${truncated}`;
}

/** Campos traduzíveis para exibição em modal (alinhado ao pacote institution). */
export type BNCCDetailField =
    | 'code'
    | 'curriculum'
    | 'curriculumDescription'
    | 'disciplineRef'
    | 'disciplineRefDescription'
    | 'teachingStage'
    | 'teachingStageDescription'
    | 'hability'
    | 'habilityDescription'
    | 'specificSkill'
    | 'specificSkillDescription';

export interface BNCCDetailRow {
    field: BNCCDetailField;
    value: string;
}

export function bnccDetailRows(bncc: BNCCItem): BNCCDetailRow[] {
    const rows: BNCCDetailRow[] = [{ field: 'code', value: bncc.codigo_alfanumerico || '—' }];

    const cc = bncc.curriculum_component;
    const curriculumName = cc?.name?.trim() || bncc.componente_curricular?.trim();
    if (cc || bncc.curriculum_component_id || bncc.componente_curricular?.trim()) {
        rows.push({ field: 'curriculum', value: curriculumName || '—' });
        const ccd = cc?.description?.trim();
        if (ccd) rows.push({ field: 'curriculumDescription', value: ccd });
    }

    const dr = bncc.discipline_reference;
    if (dr || bncc.discipline_reference_id) {
        rows.push({ field: 'disciplineRef', value: dr?.name?.trim() || '—' });
        const drd = dr?.description?.trim();
        if (drd) rows.push({ field: 'disciplineRefDescription', value: drd });
    }

    const ts = bncc.teaching_stage;
    const stageName = ts?.name?.trim() || bncc.ano_serie?.trim();
    if (ts || bncc.teaching_stage_id || bncc.ano_serie?.trim()) {
        rows.push({ field: 'teachingStage', value: stageName || '—' });
        const tsd = ts?.description?.trim();
        if (tsd) rows.push({ field: 'teachingStageDescription', value: tsd });
    }

    const ss = bncc.specific_skills;
    const hab = ss?.habilities;
    if (hab || ss?.hability_id) {
        rows.push({ field: 'hability', value: hab?.name?.trim() || '—' });
        const hd = hab?.description?.trim();
        if (hd) rows.push({ field: 'habilityDescription', value: hd });
    }

    if (ss || bncc.specific_skills_id) {
        rows.push({ field: 'specificSkill', value: ss?.name?.trim() || '—' });
        const ssd = ss?.description?.trim();
        if (ssd) rows.push({ field: 'specificSkillDescription', value: ssd });
    }

    const legacySkill = bncc.descricao_habilidade?.trim();
    const hasSpecificSkillDescription = rows.some((r) => r.field === 'specificSkillDescription');
    if (legacySkill && !hasSpecificSkillDescription) {
        rows.push({ field: 'specificSkillDescription', value: legacySkill });
    }

    return rows;
}
