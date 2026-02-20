'use client';

import { useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { Extension } from '@tiptap/core';

// 폰트 사이즈 확장
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: () => any }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => any }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        },
    } as any;
  },
});

// 라인 하이트 확장
const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() {
    return {
      types: ['paragraph', 'heading'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }: { commands: any }) => {
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { lineHeight })
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }: { commands: any }) => {
          return this.options.types.every((type: string) =>
            commands.resetAttributes(type, 'lineHeight')
          );
        },
    } as any;
  },
});

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** 이미지 업로드 콜백 — 부모가 주입. 성공 시 URL, 실패 시 null 반환 */
  onImageUpload?: (file: File) => Promise<string | null>;
}

const TEXT_COLORS = [
  { name: '기본', color: '' },
  { name: '빨강', color: '#ef4444' },
  { name: '주황', color: '#f97316' },
  { name: '노랑', color: '#eab308' },
  { name: '초록', color: '#22c55e' },
  { name: '파랑', color: '#3b82f6' },
  { name: '보라', color: '#8b5cf6' },
  { name: '회색', color: '#6b7280' },
];

const BG_COLORS = [
  { name: '없음', color: '' },
  { name: '노랑', color: '#fef08a' },
  { name: '초록', color: '#bbf7d0' },
  { name: '파랑', color: '#bfdbfe' },
  { name: '보라', color: '#ddd6fe' },
  { name: '분홍', color: '#fbcfe8' },
  { name: '빨강', color: '#fecaca' },
  { name: '회색', color: '#e5e7eb' },
];

const FONT_SIZES = [
  { name: '12px', value: '12px' },
  { name: '14px', value: '14px' },
  { name: '16px', value: '16px' },
  { name: '18px', value: '18px' },
  { name: '20px', value: '20px' },
  { name: '24px', value: '24px' },
  { name: '28px', value: '28px' },
  { name: '32px', value: '32px' },
];

const LINE_HEIGHTS = [
  { name: '1', value: '1' },
  { name: '1.25', value: '1.25' },
  { name: '1.5', value: '1.5' },
  { name: '1.75', value: '1.75' },
  { name: '2', value: '2' },
];

function MenuBar({
  editor,
  isHtmlMode,
  onToggleHtmlMode,
  onImageUpload,
  isUploading,
}: {
  editor: Editor | null;
  isHtmlMode: boolean;
  onToggleHtmlMode: () => void;
  onImageUpload?: (file: File) => Promise<void>;
  isUploading?: boolean;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showLineHeight, setShowLineHeight] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const buttonClass = (isActive: boolean) =>
    `px-2 py-1 rounded text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;

  const Divider = () => <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1 h-6" />;

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* 첫 번째 줄: 기본 서식 */}
      <div className="flex flex-wrap items-center gap-1 p-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={buttonClass(editor.isActive('bold'))}
          title="굵게"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={buttonClass(editor.isActive('italic'))}
          title="기울임"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={buttonClass(editor.isActive('underline'))}
          title="밑줄"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={buttonClass(editor.isActive('strike'))}
          title="취소선"
        >
          <s>S</s>
        </button>

        <Divider />

        {/* 텍스트 색상 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowColorPicker(!showColorPicker);
              setShowBgColorPicker(false);
              setShowFontSize(false);
              setShowLineHeight(false);
            }}
            className={buttonClass(false)}
            title="텍스트 색상"
          >
            <span className="flex items-center gap-1">
              글자색
              <span
                className="w-4 h-4 rounded border border-gray-300 dark:border-gray-500"
                style={{
                  backgroundColor: editor.getAttributes('textStyle').color || 'transparent',
                  background: !editor.getAttributes('textStyle').color ? 'linear-gradient(135deg, #fff 45%, #ccc 45%, #ccc 55%, #fff 55%)' : undefined
                }}
              />
            </span>
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 min-w-[200px]">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">텍스트 색상</div>
              <div className="grid grid-cols-4 gap-2">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.color || 'default'}
                    type="button"
                    onClick={() => {
                      if (c.color) {
                        editor.chain().focus().setColor(c.color).run();
                      } else {
                        editor.chain().focus().unsetColor().run();
                      }
                      setShowColorPicker(false);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span
                      className="w-8 h-8 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center"
                      style={{
                        backgroundColor: c.color || 'transparent',
                        background: !c.color ? 'linear-gradient(135deg, #fff 45%, #ccc 45%, #ccc 55%, #fff 55%)' : c.color
                      }}
                    >
                      {!c.color && <span className="text-gray-500 font-bold text-xs">Aa</span>}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 배경색 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowBgColorPicker(!showBgColorPicker);
              setShowColorPicker(false);
              setShowFontSize(false);
              setShowLineHeight(false);
            }}
            className={buttonClass(editor.isActive('highlight'))}
            title="배경색"
          >
            <span className="flex items-center gap-1">
              배경색
              <span className="w-4 h-4 rounded border border-gray-300 bg-yellow-200" />
            </span>
          </button>
          {showBgColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 min-w-[200px]">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">배경 색상</div>
              <div className="grid grid-cols-4 gap-2">
                {BG_COLORS.map((c) => (
                  <button
                    key={c.color || 'none'}
                    type="button"
                    onClick={() => {
                      if (c.color) {
                        editor.chain().focus().toggleHighlight({ color: c.color }).run();
                      } else {
                        editor.chain().focus().unsetHighlight().run();
                      }
                      setShowBgColorPicker(false);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span
                      className="w-8 h-8 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: c.color || '#ffffff' }}
                    >
                      {!c.color && <span className="text-gray-400 text-lg">✕</span>}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* 폰트 크기 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowFontSize(!showFontSize);
              setShowColorPicker(false);
              setShowBgColorPicker(false);
              setShowLineHeight(false);
            }}
            className={buttonClass(false)}
            title="글자 크기"
          >
            크기
          </button>
          {showFontSize && (
            <div className="absolute top-full left-0 mt-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
              {FONT_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    (editor.chain().focus() as any).setFontSize(s.value).run();
                    setShowFontSize(false);
                  }}
                  className="block w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 줄 간격 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowLineHeight(!showLineHeight);
              setShowColorPicker(false);
              setShowBgColorPicker(false);
              setShowFontSize(false);
            }}
            className={buttonClass(false)}
            title="줄 간격"
          >
            줄간격
          </button>
          {showLineHeight && (
            <div className="absolute top-full left-0 mt-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
              {LINE_HEIGHTS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => {
                    (editor.chain().focus() as any).setLineHeight(l.value).run();
                    setShowLineHeight(false);
                  }}
                  className="block w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* 제목 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={buttonClass(editor.isActive('heading', { level: 2 }))}
          title="제목"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={buttonClass(editor.isActive('heading', { level: 3 }))}
          title="소제목"
        >
          H3
        </button>

        <Divider />

        {/* 정렬 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={buttonClass(editor.isActive({ textAlign: 'left' }))}
          title="왼쪽 정렬"
        >
          ≡
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={buttonClass(editor.isActive({ textAlign: 'center' }))}
          title="가운데 정렬"
        >
          ≡
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={buttonClass(editor.isActive({ textAlign: 'right' }))}
          title="오른쪽 정렬"
        >
          ≡
        </button>
      </div>

      {/* 두 번째 줄: 목록, 테이블, 기타 */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={buttonClass(editor.isActive('bulletList'))}
          title="글머리 기호"
        >
          • 목록
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={buttonClass(editor.isActive('orderedList'))}
          title="번호 목록"
        >
          1. 목록
        </button>

        <Divider />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={buttonClass(editor.isActive('blockquote'))}
          title="인용"
        >
          " 인용
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={buttonClass(false)}
          title="구분선"
        >
          ─
        </button>

        <Divider />

        {/* 테이블 */}
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          className={buttonClass(false)}
          title="테이블 삽입"
        >
          표 삽입
        </button>
        {editor.isActive('table') && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className={buttonClass(false)}
              title="열 추가"
            >
              +열
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className={buttonClass(false)}
              title="행 추가"
            >
              +행
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className={buttonClass(false)}
              title="열 삭제"
            >
              -열
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className={buttonClass(false)}
              title="행 삭제"
            >
              -행
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className={buttonClass(false)}
              title="표 삭제"
            >
              표 삭제
            </button>
          </>
        )}

        <Divider />

        {/* 이미지 삽입 */}
        {onImageUpload && (
          <>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploading}
              className={buttonClass(false)}
              title="이미지 삽입"
            >
              {isUploading ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  업로드중
                </span>
              ) : (
                '🖼 이미지'
              )}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // input 초기화 (같은 파일 재선택 가능)
                e.target.value = '';
                await onImageUpload(file);
              }}
            />
          </>
        )}

        <div className="flex-1" />

        {/* HTML 모드 토글 */}
        <button
          type="button"
          onClick={onToggleHtmlMode}
          className={buttonClass(isHtmlMode)}
          title="HTML 편집"
        >
          {'</>'}
        </button>
      </div>
    </div>
  );
}

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = '내용을 입력하세요...',
  onImageUpload,
}: RichTextEditorProps) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(value);
  const [isUploading, setIsUploading] = useState(false);

  // ref로 최신 콜백/인스턴스를 유지 — editorProps 핸들러에서 안전하게 참조
  const onImageUploadRef = useRef(onImageUpload);
  onImageUploadRef.current = onImageUpload;
  const editorRef = useRef<Editor | null>(null);

  /** 이미지 파일 → 업로드 → URL로 삽입하는 공통 핸들러 */
  const handleImageFile = useCallback(async (file: File) => {
    const ed = editorRef.current;
    if (!ed || !onImageUploadRef.current) return;
    setIsUploading(true);
    try {
      const url = await onImageUploadRef.current(file);
      if (url) {
        ed.chain().focus().setImage({ src: url }).run();
      }
    } finally {
      setIsUploading(false);
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontSize,
      LineHeight,
      Image.configure({ inline: true, allowBase64: false }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHtmlContent(html);
      onChange?.(html);
    },
    editorProps: {
      // 클립보드 이미지 붙여넣기 가로채기
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !onImageUploadRef.current) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              handleImageFile(file);
              return true;
            }
          }
        }
        return false;
      },
      // 드래그앤드롭 이미지 가로채기
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length || !onImageUploadRef.current) return false;

        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'));
        if (imageFile) {
          handleImageFile(imageFile);
          return true;
        }
        return false;
      },
    },
  });

  // editor 인스턴스를 ref에 저장 — paste/drop 핸들러에서 참조
  editorRef.current = editor;

  const handleToggleHtmlMode = useCallback(() => {
    if (isHtmlMode && editor) {
      // HTML 모드에서 비주얼 모드로 전환
      editor.commands.setContent(htmlContent);
    }
    setIsHtmlMode(!isHtmlMode);
  }, [isHtmlMode, editor, htmlContent]);

  const handleHtmlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newHtml = e.target.value;
      setHtmlContent(newHtml);
      onChange?.(newHtml);
    },
    [onChange]
  );

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <MenuBar
        editor={editor}
        isHtmlMode={isHtmlMode}
        onToggleHtmlMode={handleToggleHtmlMode}
        onImageUpload={onImageUpload ? handleImageFile : undefined}
        isUploading={isUploading}
      />

      {isHtmlMode ? (
        <textarea
          value={htmlContent}
          onChange={handleHtmlChange}
          className="w-full p-4 min-h-[200px] font-mono text-sm bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none resize-y"
          placeholder="HTML 코드를 입력하세요..."
        />
      ) : (
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[200px] focus:outline-none"
        />
      )}

      <style jsx global>{`
        .tiptap {
          min-height: 200px;
          padding: 1rem;
        }
        .tiptap:focus {
          outline: none;
        }
        .tiptap p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .dark .tiptap p.is-editor-empty:first-child::before {
          color: #6b7280;
        }
        .tiptap ul {
          list-style-type: disc;
          padding-left: 1.5rem;
        }
        .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
        }
        .tiptap blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1rem;
          margin-left: 0;
          color: #6b7280;
        }
        .dark .tiptap blockquote {
          border-left-color: #4b5563;
          color: #9ca3af;
        }
        .tiptap h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .tiptap h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .tiptap hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1rem 0;
        }
        .dark .tiptap hr {
          border-top-color: #4b5563;
        }
        .tiptap table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .tiptap th,
        .tiptap td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem;
          min-width: 50px;
        }
        .dark .tiptap th,
        .dark .tiptap td {
          border-color: #4b5563;
        }
        .tiptap th {
          background-color: #f3f4f6;
          font-weight: 600;
        }
        .dark .tiptap th {
          background-color: #374151;
        }
        .tiptap .selectedCell {
          background-color: #dbeafe;
        }
        .dark .tiptap .selectedCell {
          background-color: #1e3a5f;
        }
        .tiptap mark {
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
        }
        .tiptap img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  );
}
