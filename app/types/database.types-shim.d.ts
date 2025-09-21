// Auto-generated database.types.ts is a pure-type module. Some tools/imports
// expect helper types like `Tables` and may misreport "not a module".
// This shim augments the '~/*' path import to ensure consistent type exports.

declare module "~/types/database.types" {
  export type Database = import("./database.types").Database;
  export type Json = import("./database.types").Json;

  export type Tables<
    T extends keyof Database["public"]["Tables"] = keyof Database["public"]["Tables"]
  > = Database["public"]["Tables"][T]["Row"];

  export type TablesInsert<
    T extends keyof Database["public"]["Tables"] = keyof Database["public"]["Tables"]
  > = Database["public"]["Tables"][T]["Insert"];

  export type TablesUpdate<
    T extends keyof Database["public"]["Tables"] = keyof Database["public"]["Tables"]
  > = Database["public"]["Tables"][T]["Update"];

  // Enum helpers used across the app
  export type Enums<
    T extends keyof Database["public"]["Enums"]
  > = Database["public"]["Enums"][T];

  // Runtime export (declared for typing); implemented in database.types.ts
  export const Constants: {
    public: {
      Enums: Database["public"]["Enums"]
    }
  };
}
