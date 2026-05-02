"use client";
import { useEffect, useRef } from "react";
import EditorJS, { OutputData } from "@editorjs/editorjs";
// @ts-ignore
import Header from "@editorjs/header";
// @ts-ignore
import List from "@editorjs/list";
// @ts-ignore
import Checklist from "@editorjs/checklist";
// @ts-ignore
import Quote from "@editorjs/quote";
// @ts-ignore
import Code from "@editorjs/code";
// @ts-ignore
import InlineCode from "@editorjs/inline-code";
// @ts-ignore
import Marker from "@editorjs/marker";
// @ts-ignore
import Delimiter from "@editorjs/delimiter";

interface Props {
  data: OutputData | null;
  readOnly?: boolean;
  onChange?: (data: OutputData) => void;
  externalVersion?: number;
  onCursorChange?: (
    data: { index: number; length: number; x: number; y: number } | null,
  ) => void;
}

export const Editor = ({
  data,
  readOnly = false,
  onChange,
  externalVersion = 0,
  onCursorChange,
}: Props) => {
  const holderRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorJS | null>(null);
  const lastVersion = useRef(externalVersion);
  const cursorTrackerRef = useRef<NodeJS.Timeout>();

  const trackCursor = () => {
    if (!holderRef.current || readOnly) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (onCursorChange) onCursorChange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(holderRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const index = preCaretRange.toString().length;
    const length = range.toString().length;

    // Get visual coordinates - use cursor rect for more accurate position
    const rect = range.getBoundingClientRect();
    const editorRect = holderRef.current.getBoundingClientRect();

    // Calculate position relative to editor, accounting for editor scroll
    let x = rect.left - editorRect.left;
    let y = rect.top - editorRect.top;

    // Add scroll offset if editor has scroll
    x += holderRef.current.scrollLeft || 0;
    y += holderRef.current.scrollTop || 0;

    // Ensure we have valid coordinates
    if (x >= 0 && y >= 0) {
      if (onCursorChange) onCursorChange({ index, length, x, y });
    }
  };

  useEffect(() => {
    if (!holderRef.current || editorRef.current) return;
    const editor = new EditorJS({
      holder: holderRef.current,
      readOnly,
      placeholder: "Start writing, or press / for blocks...",
      data: data ?? { blocks: [] },
      autofocus: !readOnly,
      minHeight: 300,
      tools: {
        header: {
          class: Header,
          config: { levels: [1, 2, 3], defaultLevel: 2 },
        },
        paragraph: {
          config: {
            preserveBlank: true,
          },
        },
        list: List,
        checklist: Checklist,
        quote: Quote,
        code: Code,
        inlineCode: InlineCode,
        marker: Marker,
        delimiter: Delimiter,
      },
      onChange: async () => {
        if (!editorRef.current || !onChange) return;
        try {
          const saved = await editorRef.current.save();
          onChange(saved);
        } catch {}
      },
    });
    editorRef.current = editor;

    // Setup cursor tracking with multiple events
    const onCursorEvent = () => trackCursor();
    if (holderRef.current && !readOnly) {
      holderRef.current.addEventListener("pointerup", onCursorEvent);
      holderRef.current.addEventListener("pointerdown", onCursorEvent);
      holderRef.current.addEventListener("click", onCursorEvent);
      holderRef.current.addEventListener("keyup", onCursorEvent);
      holderRef.current.addEventListener("keydown", onCursorEvent);
      document.addEventListener("selectionchange", onCursorEvent);
    }

    return () => {
      if (holderRef.current && !readOnly) {
        holderRef.current.removeEventListener("pointerup", onCursorEvent);
        holderRef.current.removeEventListener("pointerdown", onCursorEvent);
        holderRef.current.removeEventListener("click", onCursorEvent);
        holderRef.current.removeEventListener("keyup", onCursorEvent);
        holderRef.current.removeEventListener("keydown", onCursorEvent);
        document.removeEventListener("selectionchange", onCursorEvent);
      }
      try {
        editorRef.current?.destroy?.();
      } catch {}
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editorRef.current || externalVersion === lastVersion.current || !data)
      return;
    lastVersion.current = externalVersion;
    (async () => {
      try {
        await editorRef.current?.isReady;
        await editorRef.current?.render(data);
      } catch {}
    })();
  }, [externalVersion, data]);

  return <div ref={holderRef} className="notion-editor relative" />;
};
