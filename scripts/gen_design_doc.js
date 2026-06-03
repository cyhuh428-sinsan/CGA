const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents
} = require("docx");
const fs = require("fs");

// ── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  dark:    "1F3864",
  accent:  "2E75B6",
  lBlue:   "D9E2F3",
  stepBg:  "EBF3FB",
  warnBg:  "FFF2CC",
  warnFg:  "9C5A00",
  scrnBg:  "F7F9FC",
  green:   "1A7F37",
  greenBg: "E6F4EA",
  white:   "FFFFFF",
  gray:    "888888",
  charcoal:"333333",
  blocked: "FDECEA",
  blockedFg:"C0392B",
};

// ── Border helpers ────────────────────────────────────────────────────────────
const bS = (c="CCCCCC",sz=4) => ({ style: BorderStyle.SINGLE, size: sz, color: c });
const bN = () => ({ style: BorderStyle.NONE,   size: 0,  color: "FFFFFF" });
const allB  = () => ({ top:bS(), bottom:bS(), left:bS(), right:bS() });
const boldB = () => ({ top:bS(C.accent,8), bottom:bS(C.accent,8), left:bS(C.accent,8), right:bS(C.accent,8) });
const noB   = () => ({ top:bN(), bottom:bN(), left:bN(), right:bN() });

// ── Paragraph factories ───────────────────────────────────────────────────────
const run = (text, opts={}) =>
  new TextRun({ text, font:"Malgun Gothic", size:22, ...opts });

const para = (text, pOpts={}, rOpts={}) =>
  new Paragraph({ spacing:{before:60,after:60}, ...pOpts,
    children:[run(text, rOpts)] });

const h1 = t => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing:{before:480,after:200},
  border:{bottom:{style:BorderStyle.SINGLE,size:6,color:C.accent,space:4}},
  children:[run(t,{size:36,bold:true,color:C.dark})]
});
const h2 = t => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing:{before:320,after:160},
  children:[run(t,{size:28,bold:true,color:C.accent})]
});
const h3 = t => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing:{before:200,after:100},
  children:[run(t,{size:24,bold:true,color:C.dark})]
});
const pb  = () => new Paragraph({children:[new PageBreak()]});
const sp  = (n=1) => Array.from({length:n},()=>new Paragraph({children:[run("")]}));
const bp  = t => new Paragraph({
  numbering:{reference:"bullets",level:0},
  spacing:{before:40,after:40},
  children:[run(t)]
});

// ── Cell factory ──────────────────────────────────────────────────────────────
const cel = (children, {w=2000,bg=null,borders=null,vspan=null,colspan=null,pad={top:80,bottom:80,left:120,right:120}}={}) => {
  const cfg = {
    width:{size:w,type:WidthType.DXA},
    borders: borders ?? allB(),
    margins: pad,
    children: Array.isArray(children) ? children : [children]
  };
  if (bg) cfg.shading = {fill:bg,type:ShadingType.CLEAR};
  if (vspan) cfg.verticalMerge = vspan;
  if (colspan) cfg.columnSpan = colspan;
  return new TableCell(cfg);
};

const cp = (text, rOpts={}, pOpts={}) =>
  new Paragraph({spacing:{before:60,after:60},...pOpts, children:[run(text,rOpts)]});

// ── Simple table (header row + data rows) ─────────────────────────────────────
function gridTable(colW, headCells, dataRows) {
  const total = colW.reduce((a,b)=>a+b,0);
  const mkRow = (cells, isHead) => new TableRow({
    children: cells.map((txt,i) => cel(
      cp(txt, isHead?{bold:true,color:C.white,size:20}:{size:19},
               {alignment:AlignmentType.CENTER}),
      {w:colW[i], bg: isHead?C.dark:(dataRows.indexOf(cells)%2===0?C.white:C.scrnBg)}
    ))
  });
  return new Table({
    width:{size:total,type:WidthType.DXA},
    columnWidths:colW,
    rows:[mkRow(headCells,true), ...dataRows.map(r=>mkRow(r,false))]
  });
}

// ── Key-value info table ──────────────────────────────────────────────────────
function infoTable(rows, colW=[2400,6960]) {
  return new Table({
    width:{size:colW[0]+colW[1],type:WidthType.DXA},
    columnWidths:colW,
    rows: rows.map(([label,value]) => new TableRow({ children:[
      cel(cp(label,{bold:true,size:20}), {w:colW[0],bg:C.lBlue}),
      cel(cp(value,{size:20}),           {w:colW[1]}),
    ]}))
  });
}

// ── Step rail bar ─────────────────────────────────────────────────────────────
function stepBar(steps, activeIdx) {
  const w = Math.floor(9360/steps.length);
  return new Table({
    width:{size:9360,type:WidthType.DXA},
    columnWidths: steps.map(()=>w),
    rows:[new TableRow({ children: steps.map((s,i)=> cel(
      cp(s,{size:18,bold:i===activeIdx,color:i===activeIdx?C.white:"444444"},{alignment:AlignmentType.CENTER}),
      {w, bg: i===activeIdx?C.accent:C.stepBg, borders:{top:bS(),bottom:bS(),left:bN(),right:bN()}}
    ))})]
  });
}

// ── Banner (dark header) ──────────────────────────────────────────────────────
function banner(title, sub) {
  return new Table({
    width:{size:9360,type:WidthType.DXA}, columnWidths:[9360],
    rows:[new TableRow({ children:[cel(
      [cp(title,{size:28,bold:true,color:C.white}),
       sub?cp(sub,{size:19,color:"AAAAAA"}):new Paragraph({children:[]})],
      {w:9360,bg:C.dark,borders:noB(),pad:{top:140,bottom:140,left:200,right:200}}
    )]})]
  });
}

// ── Alert box ─────────────────────────────────────────────────────────────────
function alertBox(text, type="warn") {
  const bg  = type==="warn"?C.warnBg : type==="block"?C.blocked : C.greenBg;
  const col = type==="warn"?C.warnFg : type==="block"?C.blockedFg : C.green;
  const icon = type==="warn"?"⚠  " : type==="block"?"✗  " : "✓  ";
  return new Table({
    width:{size:9360,type:WidthType.DXA}, columnWidths:[9360],
    rows:[new TableRow({ children:[cel(
      cp(icon+text,{size:22,bold:true,color:col}),
      {w:9360,bg,borders:{top:bS(col,8),bottom:bS(col,8),left:bS(col,8),right:bS(col,8)},pad:{top:100,bottom:100,left:200,right:200}}
    )]})]
  });
}

// ── Two-panel layout ──────────────────────────────────────────────────────────
function twoPanel(leftW, rightW, leftChildren, rightChildren, leftBg=C.white, rightBg=C.lBlue) {
  return new Table({
    width:{size:leftW+rightW,type:WidthType.DXA}, columnWidths:[leftW,rightW],
    rows:[new TableRow({ children:[
      cel(leftChildren,  {w:leftW,  bg:leftBg,  borders:boldB(), pad:{top:140,bottom:140,left:180,right:140}}),
      cel(rightChildren, {w:rightW, bg:rightBg, borders:boldB(), pad:{top:140,bottom:140,left:140,right:180}}),
    ]})]
  });
}

// ── Input mockup row (label + field-like box) ─────────────────────────────────
function fakeField(label, placeholder, w=5800) {
  return [
    cp(label,{size:20,bold:true}),
    new Table({width:{size:w,type:WidthType.DXA},columnWidths:[w],rows:[new TableRow({children:[
      cel(cp(placeholder,{size:19,color:C.gray}),{w,borders:allB()})
    ]})]}),
  ];
}

// ── Button row ────────────────────────────────────────────────────────────────
function btnRow(btns, colW=[]) {
  const w = colW.length ? colW : btns.map(()=>Math.floor(9360/btns.length));
  return new Table({
    width:{size:w.reduce((a,b)=>a+b,0),type:WidthType.DXA}, columnWidths:w,
    rows:[new TableRow({children: btns.map(([label,primary],i)=>
      cel(cp(label,{size:20,bold:primary,color:primary?C.white:"000000"},{alignment:AlignmentType.CENTER}),
        {w:w[i],bg:primary?C.accent:C.white,borders:allB(),pad:{top:80,bottom:80,left:100,right:100}})
    )})]
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering:{config:[{reference:"bullets",levels:[{
    level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,
    style:{paragraph:{indent:{left:720,hanging:360}}}
  }]}]},
  styles:{
    default:{document:{run:{font:"Malgun Gothic",size:22}}},
    paragraphStyles:[
      {id:"Heading1",name:"Heading 1",basedOn:"Normal",next:"Normal",quickFormat:true,
       run:{size:36,bold:true,font:"Malgun Gothic",color:C.dark},
       paragraph:{spacing:{before:480,after:200},outlineLevel:0}},
      {id:"Heading2",name:"Heading 2",basedOn:"Normal",next:"Normal",quickFormat:true,
       run:{size:28,bold:true,font:"Malgun Gothic",color:C.accent},
       paragraph:{spacing:{before:320,after:160},outlineLevel:1}},
      {id:"Heading3",name:"Heading 3",basedOn:"Normal",next:"Normal",quickFormat:true,
       run:{size:24,bold:true,font:"Malgun Gothic",color:C.dark},
       paragraph:{spacing:{before:200,after:100},outlineLevel:2}},
    ]
  },
  sections:[{
    properties:{page:{
      size:{width:12240,height:15840},
      margin:{top:1080,right:1080,bottom:1080,left:1080}
    }},
    headers:{default:new Header({children:[new Paragraph({
      alignment:AlignmentType.RIGHT,
      border:{bottom:{style:BorderStyle.SINGLE,size:4,color:"CCCCCC",space:1}},
      children:[run("CGA Studio  |  화면 설계서  v2.0",{size:18,color:C.gray})]
    })]})},
    footers:{default:new Footer({children:[new Paragraph({
      alignment:AlignmentType.CENTER,
      border:{top:{style:BorderStyle.SINGLE,size:4,color:"CCCCCC",space:1}},
      children:[
        run("CONFIDENTIAL  |  Page ",{size:18,color:C.gray}),
        new TextRun({children:[PageNumber.CURRENT],font:"Malgun Gothic",size:18,color:C.gray}),
      ]
    })]})},

    children:[

      // ══ COVER ═══════════════════════════════════════════════════════════════
      new Table({width:{size:10080,type:WidthType.DXA},columnWidths:[10080],rows:[
        new TableRow({children:[cel(
          [new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:600},
             children:[run("CGA Studio",{size:72,bold:true,color:C.white})]}),
           new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120},
             children:[run("Chatbot Generator Agent",{size:32,color:"AAAAAA"})]}),
           new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:400},
             children:[run("화면 설계서  |  Screen Design Specification",{size:30,bold:true,color:C.white})]}),
           new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:80,after:600},
             children:[run("v 2.0  |  2026",{size:22,color:"AAAAAA"})]}),
          ],
          {w:10080,bg:C.dark,borders:noB(),pad:{top:0,bottom:0,left:400,right:400}}
        )]})
      ]}),

      ...sp(1),

      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[4680,4680],rows:[
        new TableRow({children:[
          cel([cp("핵심 원칙",{size:22,bold:true,color:C.accent}),
               ...sp(1),
               cp("• 봇 구성은 LLM 전용  (ML·시멘틱 엔진 불사용)",{size:20}),
               cp("• 학습문장: LLM 미연결 시 수동 Handoff 가능",{size:20}),
               cp("• PDF 구성: LLM 연결 필수",{size:20}),
               cp("• Aidot API·런타임 계약 완전 호환",{size:20}),
              ],{w:4680,bg:C.stepBg,borders:noB(),pad:{top:160,bottom:160,left:200,right:160}}),
          cel([cp("적용 범위",{size:22,bold:true,color:C.accent}),
               ...sp(1),
               cp("CGA Studio 웹 애플리케이션 전체 화면",{size:20}),
               cp("데스크탑 기준 (1280px 이상)",{size:20}),
               cp("봇 제작 8단계 전체 커버",{size:20}),
              ],{w:4680,bg:C.stepBg,borders:noB(),pad:{top:160,bottom:160,left:160,right:200}}),
        ]})
      ]}),

      pb(),

      // ══ TOC ══════════════════════════════════════════════════════════════════
      h1("목차"),
      new TableOfContents("목차",{hyperlink:true,headingStyleRange:"1-3"}),

      pb(),

      // ══ 1. 시스템 개요 ═══════════════════════════════════════════════════════
      h1("1. 시스템 개요"),
      para("CGA Studio는 봇 제작 순서를 중심으로 Aidot 기능을 재배치한 워크플로우 중심 봇 제작 플랫폼입니다. 사용자는 단계를 따라가기만 하면 완성된 챗봇을 빌드하고 운영할 수 있습니다.",{spacing:{before:60,after:120}}),

      h2("1.1  CGA vs Aidot 핵심 차이"),
      infoTable([
        ["봇 구성 엔진","Aidot: ML / 시멘틱 / LLM 세 가지 모두 사용 가능\nCGA: 구성 단계에서 LLM 전용으로 제한"],
        ["의도 생성 방식","학습문장 → LLM이 의도 분류 / PDF → LLM이 Q&A 의도 생성"],
        ["LLM 미연결 시","학습문장 경로: 수동 LLM Handoff(파일 내보내기·가져오기) 가능\nPDF 경로: 구성 불가 (LLM 연결 필수)"],
        ["화면 구성","기능 메뉴 아닌 봇 제작 순서 (단계 레일)로 배치"],
        ["API·런타임","Aidot 표준 계약 동일 유지 — 기존 Aidot 클라이언트 완전 호환"],
      ]),

      ...sp(1),
      h2("1.2  전체 제작 단계"),
      gridTable(
        [700,1800,4360,2500],
        ["단계","이름","핵심 작업","완료 조건"],
        [
          ["01","봇 생성","봇명·기본 파라미터 입력","봇명 저장"],
          ["02","봇 구성","학습문장 또는 PDF로 LLM 의도 생성·편집","의도 1개 이상 완료"],
          ["03","상세 설정","동의어·개체·사전·시나리오·API 도구","저장 완료"],
          ["04","빌드","서버·클라이언트 빌드 및 배포","빌드 성공"],
          ["05","테스트","시뮬레이터 대화 테스트","테스트 통과"],
          ["06","운영","모니터링·동적 의도 확장 승인·재학습","배포 완료"],
        ]
      ),

      pb(),

      // ══ 2. 글로벌 레이아웃 ═══════════════════════════════════════════════════
      h1("2. 글로벌 레이아웃"),
      para("모든 화면은 아래 4영역 구조를 공유합니다.",{spacing:{before:60,after:120}}),

      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[9360],rows:[
        // TopBar
        new TableRow({children:[cel(
          cp("① 상단 글로벌 바 (TopBar) — 봇명 / 버전 / 저장 상태 / 임시저장 / 계속",
            {size:20,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),
          {w:9360,bg:C.dark,borders:noB(),pad:{top:80,bottom:80,left:200,right:200}}
        )]}),
        // Body row
        new TableRow({children:[cel(
          new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[1700,5100,2560],rows:[
            new TableRow({children:[
              // Step rail
              cel([
                cp("② 단계 레일",{size:20,bold:true,color:C.accent},{alignment:AlignmentType.CENTER}),
                ...["01  봇 생성","02  봇 구성","03  상세 설정","04  빌드","05  테스트","06  운영"]
                  .map((s,i)=>cp(s,{size:18,color:i===1?C.accent:"444444",bold:i===1},
                    {alignment:AlignmentType.CENTER,spacing:{before:60,after:60}})),
              ],{w:1700,bg:C.stepBg,borders:noB(),pad:{top:100,bottom:100,left:60,right:60}}),
              // Stage
              cel([
                cp("③ 작업 영역 (Stage)",{size:20,bold:true,color:C.accent},{alignment:AlignmentType.CENTER}),
                cp("현재 단계의 주요 입력 / 편집 / 미리보기 화면",{size:19,color:"555555"},{alignment:AlignmentType.CENTER}),
              ],{w:5100,bg:C.white,borders:noB(),pad:{top:120,bottom:120,left:120,right:120}}),
              // Summary
              cel([
                cp("④ 요약 패널",{size:20,bold:true,color:C.accent},{alignment:AlignmentType.CENTER}),
                cp("봇 초안 요약",{size:18},{alignment:AlignmentType.CENTER}),
                cp("구성 진행 상태",{size:18},{alignment:AlignmentType.CENTER}),
                cp("다음 단계 가이드",{size:18},{alignment:AlignmentType.CENTER}),
              ],{w:2560,bg:C.lBlue,borders:noB(),pad:{top:120,bottom:120,left:80,right:80}}),
            ]})
          ]}),
          {w:9360,borders:noB()}
        )]}),
      ]}),

      pb(),

      // ══ 3. 01단계 봇 생성 ════════════════════════════════════════════════════
      h1("3. 01단계 — 봇 생성"),
      para("가장 먼저 진입하는 화면입니다. 봇의 이름과 기본 파라미터를 설정합니다. 복잡한 용어 없이 최소 입력만으로 봇 초안을 생성합니다.",{spacing:{before:60,after:120}}),

      stepBar(["01 봇 생성","02 봇 구성","03 상세 설정","04 빌드","05 테스트","06 운영"],0),
      ...sp(1),

      twoPanel(6400,2960,
        // 왼쪽: 입력 폼
        [
          cp("01  봇 생성",{size:26,bold:true,color:C.dark}),
          cp("봇을 시작하기 위한 기본 파라미터를 설정하세요.",{size:19,color:"555555"},{spacing:{before:40,after:160}}),

          cp("봇 이름  *",{size:20,bold:true}),
          new Table({width:{size:5800,type:WidthType.DXA},columnWidths:[5800],rows:[new TableRow({children:[
            cel(cp("예: 고객지원 챗봇",{size:19,color:C.gray}),{w:5800})
          ]})]}),

          cp("기본 언어",{size:20,bold:true},{spacing:{before:120}}),
          new Table({width:{size:5800,type:WidthType.DXA},columnWidths:[1450,1450,1450,1450],rows:[new TableRow({children:[
            cel(cp("한국어",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),{w:1450,bg:C.accent}),
            cel(cp("English",{size:19},{alignment:AlignmentType.CENTER}),{w:1450}),
            cel(cp("日本語",{size:19},{alignment:AlignmentType.CENTER}),{w:1450}),
            cel(cp("기타…",{size:19},{alignment:AlignmentType.CENTER}),{w:1450}),
          ]})]}),

          cp("배포 채널  (Aidot 호환)",{size:20,bold:true},{spacing:{before:120}}),
          new Table({width:{size:5800,type:WidthType.DXA},columnWidths:[1933,1933,1934],rows:[new TableRow({children:[
            cel([cp("✓  Web",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),
                 cp("공유 웹챗 계약",{size:17,color:C.white},{alignment:AlignmentType.CENTER})],
                {w:1933,bg:C.accent}),
            cel([cp("설치형 프로그램",{size:19},{alignment:AlignmentType.CENTER}),
                 cp("AM / 채널 호환",{size:17,color:C.gray},{alignment:AlignmentType.CENTER})],{w:1933}),
            cel([cp("카카오톡",{size:19},{alignment:AlignmentType.CENTER}),
                 cp("한국 로케일",{size:17,color:C.gray},{alignment:AlignmentType.CENTER})],{w:1934}),
          ]})]}),

          cp("오케스트레이터 모드",{size:20,bold:true},{spacing:{before:120}}),
          new Table({width:{size:5800,type:WidthType.DXA},columnWidths:[1933,1933,1934],rows:[new TableRow({children:[
            cel(cp("나중에 결정",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),{w:1933,bg:C.accent}),
            cel(cp("내장 컨테이너",{size:19},{alignment:AlignmentType.CENTER}),{w:1933}),
            cel(cp("기존 연결",{size:19},{alignment:AlignmentType.CENTER}),{w:1934}),
          ]})]}),

          cp("LLM 연결",{size:20,bold:true},{spacing:{before:120}}),
          new Table({width:{size:5800,type:WidthType.DXA},columnWidths:[5800],rows:[new TableRow({children:[
            cel(cp("연결된 LLM 없음  —  설정에서 연결하거나 봇 구성 후 수동 Handoff 사용",
                   {size:19,color:C.warnFg}),{w:5800,bg:C.warnBg})
          ]})]}),

          ...sp(1),
          btnRow([["임시 저장",false],["다음  →  봇 구성",true]],[2800,3000]),
        ],
        // 오른쪽: 요약
        [
          cp("봇 초안 요약",{size:22,bold:true,color:C.dark}),
          cp("(이름 미입력)",{size:20,color:C.gray},{spacing:{before:60}}),
          cp("언어: 한국어",{size:19}),
          cp("채널: Web",{size:19}),
          cp("오케스트레이터: 나중에 결정",{size:19}),
          cp("LLM: 미연결",{size:19,color:C.warnFg}),
          cp("준비 상태",{size:20,bold:true,color:C.dark},{spacing:{before:120}}),
          cp("○ 봇 이름 입력 필요",{size:19,color:C.gray}),
          cp("다음 단계",{size:20,bold:true,color:C.dark},{spacing:{before:120}}),
          cp("봇 이름 입력 후\n봇 구성으로 이동합니다.",{size:19,color:"555555"}),
        ]
      ),

      pb(),

      // ══ 4. 02단계 봇 구성 ════════════════════════════════════════════════════
      h1("4. 02단계 — 봇 구성"),
      para("봇의 의도(Intent)를 LLM을 통해 구성하는 단계입니다. 두 가지 입력 경로 중 하나 또는 모두를 사용합니다.",{spacing:{before:60,after:60}}),
      alertBox("봇 구성 단계는 LLM 전용입니다. ML 엔진·시멘틱 엔진은 사용하지 않습니다.","warn"),
      ...sp(1),

      h2("4.1  두 가지 구성 경로"),
      gridTable(
        [2200,1600,2280,3280],
        ["경로","LLM 연결 필요","입력","처리 결과"],
        [
          ["A  학습문장 → 의도 분류","선택 (미연결 시 수동 Handoff)","질문 문장 더미 + 생성할 의도 개수","의도 그룹 + 대표 학습문장"],
          ["B  PDF → Q&A 의도 생성","필수","PDF 파일 + 추출할 질문 개수","질문·답변 쌍으로 구성된 의도"],
        ]
      ),

      ...sp(1),
      stepBar(["01 봇 생성","02 봇 구성","03 상세 설정","04 빌드","05 테스트","06 운영"],1),
      ...sp(1),

      // 경로 선택 탭
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[4680,4680],rows:[
        new TableRow({children:[
          cel(cp("경로 A  학습문장 → 의도 분류",{size:21,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),
              {w:4680,bg:C.accent,borders:{top:bS(C.accent,8),bottom:bN(),left:bS(C.accent,8),right:bS()}}),
          cel(cp("경로 B  PDF → Q&A 의도 생성",{size:21,color:C.gray},{alignment:AlignmentType.CENTER}),
              {w:4680,bg:C.scrnBg,borders:{top:bS(C.accent,8),bottom:bN(),left:bS(),right:bS(C.accent,8)}}),
        ]})
      ]}),

      pb(),

      // ─── 4.2 경로 A ──────────────────────────────────────────────────────────
      h2("4.2  경로 A — 학습문장 → 의도 분류"),
      para("질문 형태의 학습문장을 입력하면 LLM이 지정한 개수만큼 의도 그룹을 자동 분류합니다. LLM이 연결되지 않은 경우 수동 LLM Handoff를 통해 동일한 결과를 얻을 수 있습니다.",{spacing:{before:60,after:120}}),

      h3("A-1  학습문장 입력 화면"),

      twoPanel(6200,3160,
        [
          cp("학습문장 입력",{size:24,bold:true,color:C.dark}),
          cp("의도로 분류할 질문 문장들을 입력하세요.",{size:19,color:"555555"},{spacing:{before:40,after:120}}),

          cp("생성할 의도 개수  *",{size:20,bold:true}),
          new Table({width:{size:5600,type:WidthType.DXA},columnWidths:[5600],rows:[new TableRow({children:[
            cel(cp("10  ( 1 ~ 100 )",{size:19,color:C.gray}),{w:5600})
          ]})]}),

          cp("학습문장 입력  *",{size:20,bold:true},{spacing:{before:120}}),
          cp("줄 구분으로 한 행에 하나씩 입력하거나 파일을 업로드하세요.",{size:18,color:C.gray}),
          new Table({width:{size:5600,type:WidthType.DXA},columnWidths:[5600],rows:[new TableRow({children:[
            cel([
              cp("비밀번호를 초기화하고 싶어요",{size:19}),
              cp("배송 상태 확인하는 방법은?",{size:19}),
              cp("예약을 변경할 수 있나요?",{size:19}),
              cp("영업시간이 어떻게 되나요?",{size:19}),
              cp("반품 신청하고 싶어요",{size:19}),
              cp("환불 절차를 알려주세요",{size:19}),
              cp("…",{size:19,color:C.gray}),
            ],{w:5600,bg:C.scrnBg,pad:{top:100,bottom:100,left:120,right:120}})
          ]})]}),

          ...sp(1),
          new Table({width:{size:5600,type:WidthType.DXA},columnWidths:[2800,2800],rows:[new TableRow({children:[
            cel(cp("CSV / TXT 업로드",{size:19},{alignment:AlignmentType.CENTER}),{w:2800}),
            cel(cp("행 유효성 검사",{size:19},{alignment:AlignmentType.CENTER}),{w:2800}),
          ]})]}),

          cp("✓  6행 입력됨",{size:19,color:C.green,bold:true},{spacing:{before:100}}),
        ],
        [
          cp("LLM 연결 상태",{size:21,bold:true,color:C.dark}),
          cp("연결된 LLM 없음",{size:19,color:C.warnFg,bold:true},{spacing:{before:80}}),
          cp("아래 두 가지 방법 중 선택하세요.",{size:18,color:"555555"},{spacing:{before:60}}),
          ...sp(1),
          cp("방법 1  LLM 연결 후 자동 분류",{size:19,bold:true,color:C.dark}),
          cp("설정 화면에서 LLM을 연결하면 버튼 클릭만으로 의도가 자동 생성됩니다.",{size:18,color:"555555"}),
          new Table({width:{size:2800,type:WidthType.DXA},columnWidths:[2800],rows:[new TableRow({children:[
            cel(cp("LLM 연결 설정 →",{size:18},{alignment:AlignmentType.CENTER}),{w:2800,bg:C.scrnBg})
          ]})]}),
          ...sp(1),
          cp("방법 2  수동 LLM Handoff",{size:19,bold:true,color:C.dark}),
          cp("프롬프트+학습문장 파일을 내보내기하여 외부 LLM에 직접 질의한 후 결과 파일을 가져옵니다.",{size:18,color:"555555"}),
          new Table({width:{size:2800,type:WidthType.DXA},columnWidths:[2800],rows:[new TableRow({children:[
            cel(cp("Handoff 파일 내보내기 →",{size:18,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),{w:2800,bg:C.accent})
          ]})]}),
        ]
      ),

      ...sp(2),
      h3("A-2  수동 LLM Handoff 흐름"),
      para("LLM이 연결되지 않은 환경에서도 의도를 구성할 수 있는 방법입니다.",{spacing:{before:60,after:120}}),

      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[1868,160,1868,160,1868,160,1868,160,1228],rows:[
        new TableRow({children:[
          cel([cp("① 내보내기",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),
               cp("프롬프트 + 학습문장이 담긴 .txt 파일 다운로드",{size:17,color:C.white},{alignment:AlignmentType.CENTER})],
              {w:1868,bg:C.dark}),
          cel(cp("→",{size:20,bold:true,color:C.accent},{alignment:AlignmentType.CENTER}),
              {w:160,borders:noB(),pad:{top:80,bottom:80,left:0,right:0}}),
          cel([cp("② 외부 LLM 질의",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),
               cp("ChatGPT, Claude, Gemini 등에 파일 내용 붙여넣기",{size:17,color:C.white},{alignment:AlignmentType.CENTER})],
              {w:1868,bg:C.dark}),
          cel(cp("→",{size:20,bold:true,color:C.accent},{alignment:AlignmentType.CENTER}),
              {w:160,borders:noB(),pad:{top:80,bottom:80,left:0,right:0}}),
          cel([cp("③ 결과 복사",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),
               cp("LLM이 반환한 의도 분류 결과 텍스트 복사",{size:17,color:C.white},{alignment:AlignmentType.CENTER})],
              {w:1868,bg:C.dark}),
          cel(cp("→",{size:20,bold:true,color:C.accent},{alignment:AlignmentType.CENTER}),
              {w:160,borders:noB(),pad:{top:80,bottom:80,left:0,right:0}}),
          cel([cp("④ 가져오기",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),
               cp("결과 파일 업로드 또는 텍스트 붙여넣기",{size:17,color:C.white},{alignment:AlignmentType.CENTER})],
              {w:1868,bg:C.dark}),
          cel(cp("→",{size:20,bold:true,color:C.accent},{alignment:AlignmentType.CENTER}),
              {w:160,borders:noB(),pad:{top:80,bottom:80,left:0,right:0}}),
          cel([cp("✓ 의도 생성",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),
               cp("검수·편집 화면으로 이동",{size:17,color:C.white},{alignment:AlignmentType.CENTER})],
              {w:1228,bg:C.green}),
        ]})
      ]}),

      ...sp(2),
      h3("A-3  수동 LLM Handoff 화면 — 내보내기"),

      twoPanel(5600,3760,
        [
          cp("수동 LLM Handoff  —  파일 내보내기",{size:22,bold:true,color:C.dark}),
          cp("아래 내용을 복사하거나 파일로 다운로드하여 ChatGPT, Claude 등에 붙여넣으세요.",{size:19,color:"555555"},{spacing:{before:40,after:120}}),

          cp("내보내기 파일 미리보기",{size:20,bold:true}),
          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[5200],rows:[new TableRow({children:[
            cel([
              cp("=== CGA 수동 LLM Handoff ===",{size:18,bold:true}),
              cp("지시문: 아래 학습 문장들을 분석하여 정확히 10개의 의도(Intent) 그룹으로 분류해 주세요. 각 의도에는 의도명(영문 스네이크케이스)과 해당 의도에 속한 학습문장 목록을 포함하고, 아래 JSON 형식으로 반환하세요.",{size:17}),
              ...sp(1),
              cp('출력 형식: {"intents":[{"name":"intent_name","sample_utterances":["문장1","문장2"]}]}',{size:17,color:C.dark}),
              ...sp(1),
              cp("=== 학습 문장 ===",{size:18,bold:true}),
              cp("비밀번호를 초기화하고 싶어요",{size:17}),
              cp("배송 상태 확인하는 방법은?",{size:17}),
              cp("예약을 변경할 수 있나요?",{size:17}),
              cp("…",{size:17,color:C.gray}),
            ],{w:5200,bg:C.scrnBg,pad:{top:120,bottom:120,left:160,right:160}})
          ]})]}),

          ...sp(1),
          btnRow([["전체 복사",false],["파일 다운로드 (.txt)",true]],[2200,3000]),
        ],
        [
          cp("Handoff 안내",{size:21,bold:true,color:C.dark}),
          ...sp(1),
          cp("1단계",{size:19,bold:true,color:C.accent}),
          cp("파일을 다운로드하거나 텍스트를 복사합니다.",{size:18}),
          ...sp(1),
          cp("2단계",{size:19,bold:true,color:C.accent}),
          cp("ChatGPT, Claude, Gemini 등 LLM에 접속하여 내용을 붙여넣습니다.",{size:18}),
          ...sp(1),
          cp("3단계",{size:19,bold:true,color:C.accent}),
          cp("LLM이 반환한 JSON 결과를 복사합니다.",{size:18}),
          ...sp(1),
          cp("4단계",{size:19,bold:true,color:C.accent}),
          cp("다음 화면에서 결과를 붙여넣거나 파일로 가져오기합니다.",{size:18}),
          ...sp(1),
          new Table({width:{size:3400,type:WidthType.DXA},columnWidths:[3400],rows:[new TableRow({children:[
            cel(cp("→  결과 가져오기 화면으로",{size:18,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),{w:3400,bg:C.accent})
          ]})]}),
        ]
      ),

      pb(),

      h3("A-4  수동 LLM Handoff 화면 — 결과 가져오기"),

      twoPanel(5600,3760,
        [
          cp("수동 LLM Handoff  —  결과 가져오기",{size:22,bold:true,color:C.dark}),
          cp("LLM이 반환한 의도 분류 결과를 아래에 붙여넣거나 파일을 업로드하세요.",{size:19,color:"555555"},{spacing:{before:40,after:120}}),

          cp("결과 붙여넣기",{size:20,bold:true}),
          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[5200],rows:[new TableRow({children:[
            cel([
              cp('{"intents":[',{size:17}),
              cp('  {"name":"password_reset",',{size:17}),
              cp('   "sample_utterances":["비밀번호를 초기화하고 싶어요","비번 재설정 방법은?"]},',{size:17}),
              cp('  {"name":"delivery_status",',{size:17}),
              cp('   "sample_utterances":["배송 상태 확인하는 방법은?","내 배송 언제 와요?"]},',{size:17}),
              cp("  …",{size:17,color:C.gray}),
              cp("]}",{size:17}),
            ],{w:5200,bg:C.scrnBg,pad:{top:120,bottom:120,left:160,right:160}})
          ]})]}),

          ...sp(1),
          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[2600,2600],rows:[new TableRow({children:[
            cel(cp("파일 업로드 (.json/.txt)",{size:19},{alignment:AlignmentType.CENTER}),{w:2600}),
            cel(cp("결과 유효성 검사",{size:19},{alignment:AlignmentType.CENTER}),{w:2600}),
          ]})]}),
          ...sp(1),
          btnRow([["이전",false],["의도 생성 완료  →  검수로 이동",true]],[1600,3600]),
        ],
        [
          cp("유효성 검사 결과",{size:21,bold:true,color:C.dark}),
          ...sp(1),
          cp("✓ JSON 형식 확인",{size:19,color:C.green}),
          cp("✓ 의도 개수: 10개  (요청: 10개)",{size:19,color:C.green}),
          cp("✓ 학습문장 총 42개",{size:19,color:C.green}),
          ...sp(1),
          cp("⚠ 주의",{size:19,bold:true,color:C.warnFg}),
          cp("intent_name이 중복된 항목은 자동으로 병합됩니다.",{size:18,color:C.warnFg}),
        ]
      ),

      pb(),

      // ─── 4.3 경로 B ──────────────────────────────────────────────────────────
      h2("4.3  경로 B — PDF → Q&A 의도 생성"),
      alertBox("이 경로는 LLM 연결이 필수입니다. LLM이 연결되지 않으면 파일 저장은 가능하지만 의도 생성은 불가합니다.","warn"),
      ...sp(1),

      twoPanel(5600,3760,
        [
          cp("PDF 문서 업로드",{size:24,bold:true,color:C.dark}),
          cp("업로드한 PDF에서 LLM이 예상 질문과 답변을 추출하여 의도를 생성합니다.",{size:19,color:"555555"},{spacing:{before:40,after:120}}),

          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[5200],rows:[new TableRow({children:[
            cel([
              cp("PDF 문서를 여기에 끌어다 놓으세요",{size:20,bold:true,color:"555555"},{alignment:AlignmentType.CENTER}),
              cp("문서는 LLM 미연결 시에도 저장됩니다.",{size:18,color:C.gray},{alignment:AlignmentType.CENTER}),
              cp("Q&A 의도 생성은 LLM 연결 후 가능합니다.",{size:18,color:C.warnFg},{alignment:AlignmentType.CENTER}),
            ],{w:5200,bg:C.scrnBg,pad:{top:120,bottom:120,left:160,right:160}})
          ]})]}),

          cp("추출할 Q&A 의도 개수  *",{size:20,bold:true},{spacing:{before:120}}),
          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[5200],rows:[new TableRow({children:[
            cel(cp("20  ( 1 ~ 200 )",{size:19,color:C.gray}),{w:5200})
          ]})]}),

          cp("업로드된 문서",{size:20,bold:true},{spacing:{before:120}}),
          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[2800,1200,1200],rows:[
            new TableRow({children:[
              cel(cp("파일명",{size:19,bold:true}),{w:2800,bg:C.lBlue}),
              cel(cp("크기",{size:19,bold:true},{alignment:AlignmentType.CENTER}),{w:1200,bg:C.lBlue}),
              cel(cp("상태",{size:19,bold:true},{alignment:AlignmentType.CENTER}),{w:1200,bg:C.lBlue}),
            ]}),
            new TableRow({children:[
              cel(cp("상품가이드_2026.pdf",{size:19}),{w:2800}),
              cel(cp("2.4 MB",{size:19},{alignment:AlignmentType.CENTER}),{w:1200}),
              cel(cp("LLM 필요",{size:19,color:C.warnFg},{alignment:AlignmentType.CENTER}),{w:1200,bg:C.warnBg}),
            ]}),
          ]}),

          ...sp(1),
          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[5200],rows:[new TableRow({children:[
            cel(cp("LLM 연결 후 Q&A 의도 생성  →",{size:19,color:C.gray,bold:true},{alignment:AlignmentType.CENTER}),{w:5200,bg:C.scrnBg})
          ]})]}),
          cp("LLM이 연결되어야 활성화됩니다.",{size:17,color:C.gray},{spacing:{before:40}}),
        ],
        [
          cp("경로 B 주의사항",{size:21,bold:true,color:C.dark}),
          ...sp(1),
          cp("LLM 연결 필수",{size:19,bold:true,color:C.blockedFg}),
          cp("PDF 내용을 분석하여 질문·답변 쌍을 생성하는 작업은 LLM이 직접 처리합니다.",{size:18}),
          ...sp(2),
          cp("파일은 미리 저장 가능",{size:19,bold:true,color:C.accent}),
          cp("LLM 미연결 상태에서도 PDF 파일을 업로드해 두고, LLM 연결 후 생성을 실행할 수 있습니다.",{size:18}),
          ...sp(2),
          cp("LLM 연결 방법",{size:19,bold:true,color:C.dark}),
          cp("설정 → LLM 연결에서 API 키를 등록하세요.",{size:18}),
          ...sp(1),
          new Table({width:{size:3400,type:WidthType.DXA},columnWidths:[3400],rows:[new TableRow({children:[
            cel(cp("LLM 연결 설정 →",{size:18,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),{w:3400,bg:C.accent})
          ]})]}),
        ]
      ),

      pb(),

      // ══ 5. 의도 검수·편집 ════════════════════════════════════════════════════
      h1("5. 의도 검수·편집"),
      para("LLM이 생성한 의도 초안을 운영자가 검토하고 최종화합니다. 경로 A·B 모두 이 화면으로 연결됩니다.",{spacing:{before:60,after:120}}),

      twoPanel(5000,4360,
        [
          cp("의도 목록  (10개)",{size:22,bold:true,color:C.dark}),
          cp("의도를 선택하여 답변을 입력하거나 편집하세요.",{size:19,color:"555555"},{spacing:{before:40,after:100}}),

          new Table({width:{size:4600,type:WidthType.DXA},columnWidths:[2700,760,560,580],rows:[
            new TableRow({children:[
              cel(cp("의도명",{size:19,bold:true}),{w:2700,bg:C.lBlue}),
              cel(cp("문장수",{size:18,bold:true},{alignment:AlignmentType.CENTER}),{w:760,bg:C.lBlue}),
              cel(cp("유형",{size:18,bold:true},{alignment:AlignmentType.CENTER}),{w:560,bg:C.lBlue}),
              cel(cp("답변",{size:18,bold:true},{alignment:AlignmentType.CENTER}),{w:580,bg:C.lBlue}),
            ]}),
            ...[
              ["password_reset","8","A","✓"],
              ["delivery_status","6","A","✓"],
              ["reservation_change","5","A","○"],
              ["business_hours","4","A","○"],
              ["return_request","7","A","○"],
              ["product_warranty","—","B","✓"],
              ["installation_guide","—","B","✓"],
            ].map(([name,cnt,path,done],ri)=>new TableRow({children:[
              cel(cp(name,{size:18,bold:ri===0}),{w:2700,bg:ri===0?C.stepBg:C.white}),
              cel(cp(cnt,{size:18},{alignment:AlignmentType.CENTER}),{w:760}),
              cel(cp(path,{size:18,bold:true,
                color:path==="A"?C.accent:C.green},{alignment:AlignmentType.CENTER}),
                {w:560,bg:path==="A"?C.lBlue:C.greenBg}),
              cel(cp(done,{size:18,color:done==="✓"?C.green:C.gray},{alignment:AlignmentType.CENTER}),
                {w:580,bg:done==="✓"?C.greenBg:C.white}),
            ]})),
          ]}),

          ...sp(1),
          new Table({width:{size:4600,type:WidthType.DXA},columnWidths:[1533,1533,1534],rows:[new TableRow({children:[
            cel(cp("+ 의도 추가",{size:18},{alignment:AlignmentType.CENTER}),{w:1533}),
            cel(cp("의도 합치기",{size:18},{alignment:AlignmentType.CENTER}),{w:1533}),
            cel(cp("선택 삭제",{size:18},{alignment:AlignmentType.CENTER}),{w:1534}),
          ]})]}),
        ],
        [
          cp("password_reset  —  답변 설정",{size:21,bold:true,color:C.dark}),
          cp("경로 A  (학습문장 기반)",{size:18,color:C.accent},{spacing:{before:40,after:100}}),

          cp("답변 내용  *",{size:20,bold:true}),
          new Table({width:{size:4000,type:WidthType.DXA},columnWidths:[4000],rows:[new TableRow({children:[
            cel([
              cp("비밀번호 초기화는 로그인 화면의 [비밀번호 찾기]를 클릭하신 후, 이메일로 전송된 링크를 통해 재설정하실 수 있습니다.",{size:18}),
            ],{w:4000,bg:C.scrnBg,pad:{top:100,bottom:100,left:120,right:120}})
          ]})]}),

          cp("대표 학습문장  (편집 가능)",{size:20,bold:true},{spacing:{before:100}}),
          new Table({width:{size:4000,type:WidthType.DXA},columnWidths:[3400,600],rows:[
            new TableRow({children:[
              cel(cp("비밀번호를 초기화하고 싶어요",{size:18}),{w:3400}),
              cel(cp("삭제",{size:17,color:C.gray},{alignment:AlignmentType.CENTER}),{w:600}),
            ]}),
            new TableRow({children:[
              cel(cp("비번 재설정 방법은?",{size:18}),{w:3400}),
              cel(cp("삭제",{size:17,color:C.gray},{alignment:AlignmentType.CENTER}),{w:600}),
            ]}),
          ]}),

          ...sp(1),
          btnRow([["취소",false],["저장",true]],[1800,2200]),
        ]
      ),

      pb(),

      // ══ 6. 03단계 상세 설정 ══════════════════════════════════════════════════
      h1("6. 03단계 — 상세 설정"),
      para("의도·답변 구성 이후 고급 사용자가 접근하는 세부 편집 화면입니다. 초급 사용자는 이 단계를 건너뛰고 빌드로 진행할 수 있습니다.",{spacing:{before:60,after:120}}),

      gridTable(
        [1800,3000,4560],
        ["탭","대상","주요 편집 항목"],
        [
          ["의도·답변","모든 사용자 (봇 구성에서 이어짐)","답변 유형 변경 / 학습문장 추가·삭제"],
          ["동의어","기본 이상","같은 의미의 표현 그룹 등록"],
          ["개체","고급","날짜·수량·제품명 등 엔티티 정의"],
          ["사전","고급","도메인 전용어·약어 사전 등록"],
          ["시나리오","고급","조건 분기 대화 흐름 편집기"],
          ["API 도구","고급","외부 API 연결 및 응답 매핑"],
        ]
      ),

      ...sp(1),
      alertBox("상세 설정은 선택 사항입니다. 빌드 전에 완료하지 않아도 기본 봇은 동작합니다.","ok"),

      pb(),

      // ══ 7. 04-05단계 빌드·테스트 ═════════════════════════════════════════════
      h1("7. 04·05단계 — 빌드 및 테스트"),
      h2("7.1  빌드"),
      gridTable(
        [2000,3360,4000],
        ["배포 방식","설명","채널 연결"],
        [
          ["공용 서버","CGA 공용 Multi-tenant 인프라에 즉시 배포","Web 위젯 URL / 카카오 Webhook 자동 생성"],
          ["자체 컨테이너","고객사 서버 IP 입력 후 Docker 자동 프로비저닝","Web / 설치형 / 카카오 → 자체 서버 주소로 연결"],
        ]
      ),

      ...sp(1),
      h2("7.2  테스트 — 시뮬레이터"),
      twoPanel(5600,3760,
        [
          cp("시뮬레이터  —  대화 테스트",{size:22,bold:true,color:C.dark}),
          cp("배포 전 대화 흐름을 확인합니다.",{size:19,color:"555555"},{spacing:{before:40,after:100}}),
          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[5200],rows:[new TableRow({children:[
            cel([
              cp("[봇]  안녕하세요! 무엇을 도와드릴까요?",{size:19,color:"555555"}),
              cp("[사용자]  비밀번호를 바꾸고 싶어요",{size:19,bold:true},{spacing:{before:80}}),
              cp("[봇]  비밀번호 초기화는 로그인 화면의 [비밀번호 찾기]를 클릭하신 후 이메일 링크로 재설정하실 수 있습니다.",{size:19,color:"555555"},{spacing:{before:80}}),
            ],{w:5200,bg:C.scrnBg,pad:{top:100,bottom:100,left:160,right:160}})
          ]})]}),
          ...sp(1),
          new Table({width:{size:5200,type:WidthType.DXA},columnWidths:[3800,1400],rows:[new TableRow({children:[
            cel(cp("메시지 입력…",{size:19,color:"AAAAAA"}),{w:3800}),
            cel(cp("전송",{size:19,bold:true,color:C.white},{alignment:AlignmentType.CENTER}),{w:1400,bg:C.accent}),
          ]})]}),
        ],
        [
          cp("대화 분석",{size:21,bold:true,color:C.dark}),
          cp("매칭 의도:  password_reset",{size:19},{spacing:{before:80}}),
          cp("처리 방식:  LLM 의도 분류",{size:19}),
          cp("유사도:  0.94",{size:19}),
          cp("처리 시간:  14ms",{size:19}),
          cp("테스트 기록",{size:20,bold:true,color:C.dark},{spacing:{before:120}}),
          cp("총 5회  |  매칭 실패 0건",{size:19}),
        ]
      ),

      pb(),

      // ══ 8. 06단계 운영 ═══════════════════════════════════════════════════════
      h1("8. 06단계 — 운영"),
      h2("8.1  운영 대시보드"),
      gridTable(
        [2400,3360,3600],
        ["영역","표시 정보","알람 조건"],
        [
          ["채널 상태","Web / 설치형 / 카카오톡 연결 상태 및 응답 시간","응답 실패 3회 이상"],
          ["대화량 현황","시간대별 대화 건수 / 의도별 빈도 순위","이상 급증·급감"],
          ["미정의 의도 알람","임계치 미달 의도 감지 목록 + 승인 대기 큐","신규 미정의 의도 감지 즉시"],
          ["컨테이너 상태","자체 서버 Docker 헬스체크 결과","컨테이너 다운 즉시"],
          ["LLM 비용 현황","LLM 호출 건수 및 토큰 비용 집계","설정 임계치 초과"],
        ]
      ),

      ...sp(1),
      h2("8.2  동적 의도 확장 승인"),
      alertBox("미정의 의도 감지  —  승인 대기 중  (1건)","warn"),
      ...sp(1),

      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[9360],rows:[
        new TableRow({children:[cel([
          cp("감지된 질문:  \"법인카드 월 한도가 얼마인가요?\"",{size:20,bold:true}),
          cp("감지 시각:  2026-06-03  14:23",{size:19,color:"555555"},{spacing:{before:40}}),
          cp("시스템 제안 의도명:  corporate_card_limit",{size:19},{spacing:{before:80}}),
          cp("자동 생성 프롬프트:",{size:20,bold:true},{spacing:{before:80}}),
          new Table({width:{size:8900,type:WidthType.DXA},columnWidths:[8900],rows:[new TableRow({children:[
            cel(cp("당신은 사내 복지 및 법인카드 한도 안내 전문가입니다. 제공된 컨텍스트에 기반하여 직급별 한도를 정중히 안내하세요.",{size:19}),
                {w:8900,bg:C.scrnBg})
          ]})]}),
          ...sp(1),
          btnRow([["거절",false],["수정 후 승인",false],["승인  →  즉시 적용",true]],[2960,2960,3440]),
        ],{w:9360,borders:allB(),pad:{top:140,bottom:140,left:200,right:200}})]}),
      ]}),

      pb(),

      // ══ 9. UI 컴포넌트 가이드 ════════════════════════════════════════════════
      h1("9. UI 컴포넌트 가이드"),
      h2("9.1  색상 시스템"),
      gridTable(
        [2800,2200,4360],
        ["용도","색상 코드","적용 위치"],
        [
          ["Primary","#2E75B6","버튼·탭 선택·강조 테두리"],
          ["Dark Background","#1F3864","헤더·커버·단계 완료"],
          ["Light Blue","#D9E2F3","레이블 배경·요약 패널"],
          ["Step Background","#EBF3FB","단계 레일·준비 상태"],
          ["Warning","#FFF2CC  /  #9C5A00","LLM 미연결·승인 대기"],
          ["Success Green","#1A7F37  /  #E6F4EA","완료 상태·유효성 통과"],
          ["Screen BG","#F7F9FC","작업 영역 배경·텍스트 에어리어"],
        ]
      ),

      ...sp(1),
      h2("9.2  LLM 연결 상태 표시 규칙"),
      gridTable(
        [2400,2000,4960],
        ["상태","표시","동작"],
        [
          ["LLM 연결됨","녹색 칩  ✓ LLM 연결","경로 A/B 모두 자동 실행 가능"],
          ["LLM 미연결  (경로 A)","황색 칩  ⚠ LLM 없음","수동 Handoff 버튼 표시 / 자동 분류 버튼 비활성화"],
          ["LLM 미연결  (경로 B)","빨간 칩  ✗ LLM 필요","파일 저장 가능 / 생성 버튼 비활성화"],
        ]
      ),

      ...sp(1),
      h2("9.3  수동 LLM Handoff 파일 규격"),
      gridTable(
        [2000,3360,4000],
        ["항목","형식","설명"],
        [
          ["내보내기 파일","Plain Text (.txt)","지시 프롬프트 + 학습문장 목록 포함"],
          ["가져오기 파일","JSON (.json) 또는 Plain Text","intents 배열 구조로 의도명 + 학습문장 목록"],
          ["JSON 스키마","{ intents: [{ name, sample_utterances[] }] }","CGA가 자동 파싱 후 의도 목록 생성"],
        ]
      ),

      pb(),

      // ══ 10. Aidot 호환성 원칙 ════════════════════════════════════════════════
      h1("10. Aidot 호환성 원칙"),
      gridTable(
        [3200,2000,4160],
        ["항목","CGA 변경 여부","설명"],
        [
          ["웹챗 API","변경 없음","기존 Aidot 클라이언트 → CGA 봇 서버 그대로 연결"],
          ["AM / 채널 API","변경 없음","설치형·카카오톡 클라이언트 계약 동일"],
          ["런타임 변수·함수","변경 없음","{{ expression }}, $name 등 Aidot 규칙 동일"],
          ["시뮬레이터 동작","변경 없음","Aidot 시뮬레이터와 동일한 처리 흐름"],
          ["봇 구성 엔진 (구성 단계)","CGA 변경","LLM 전용 (ML·시멘틱 엔진 미사용)"],
          ["화면 구성·워크플로우","CGA 변경","단계 레일·초급/고급 노출 분리"],
          ["새 기능 개발","기본 금지","사전 승인 후에만 구현"],
        ]
      ),

      ...sp(2),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[9360],rows:[
        new TableRow({children:[cel([
          cp("호환성 보장 선언",{size:24,bold:true,color:C.dark}),
          cp("기존 Aidot 클라이언트는 CGA가 생성한 봇 서버에 그대로 접속할 수 있습니다.",{size:22},{spacing:{before:80}}),
          cp("CGA가 생성한 클라이언트는 Aidot 봇 서버에 그대로 접속할 수 있습니다.",{size:22}),
          cp("웹챗·AM·채널·런타임 계약은 변경 없이 완전 호환됩니다.",{size:22}),
        ],{w:9360,bg:C.stepBg,borders:boldB(),pad:{top:160,bottom:160,left:240,right:240}})]}),
      ]}),

    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("docs/CGA_Studio_화면설계서_v2.0.docx", buf);
  console.log("Done → docs/CGA_Studio_화면설계서_v2.0.docx");
}).catch(e => { console.error(e); process.exit(1); });
