/**
 * 旧「Googleマップ」タブの URL。中身は自動タスクタブ（院ごとの詳細）へ移した（2026-11-26 林さん）。
 * 古いブックマークで開かれても迷わないよう、自動タスクタブへ転送する。
 */
import { Redirect } from "wouter";

export default function GoogleMap() {
  return <Redirect to="/auto-tasks#gbp" replace />;
}
