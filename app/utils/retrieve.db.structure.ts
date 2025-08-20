import {Client} from 'pg';

/**
 * Converts a PostgreSQL array to a JavaScript string array
 * Handles both '{value1,value2}' string format and native array format
 */
function postgresArrayToStringArray(postgresArray: unknown): string[] {
    // If it's already an array (native driver format)
    if (Array.isArray(postgresArray)) {
        return postgresArray.map(item => String(item));
    }

    // If it's a string in Postgres array format like '{value1,value2}'
    if (typeof postgresArray === 'string' && postgresArray.startsWith('{') && postgresArray.endsWith('}')) {
        return postgresArray
            .replace(/^\{|}$/g, '') // Remove leading '{' and trailing '}'
            .split(',')
            .map(item => item.trim());
    }

    // If it's null, undefined, or another unexpected format
    return [];
}




export type DatabaseSchema = {
    tables: Record<string, {
        columns: {
            column_name: string;
            data_type: string;
            character_maximum_length: number | null;
            is_nullable: string;
            column_default: string | null;
        }[];
        primaryKeys: string[];
        foreignKeys: {
            column_name: string;
            foreign_table_name: string;
            foreign_column_name: string;
        }[];
        indexes: {
            indexname: string;
            indexdef: string;
        }[];
    }>;
    views: Record<string, {
        definition: string;
        columns: {
            column_name: string;
            data_type: string;
            character_maximum_length: number | null;
            is_nullable: string;
        }[];
    }>;
    functions: {
        function_name: string;
        function_definition: string;
    }[];
    enums: {
        enum_name: string;
        enum_values: string[];
    }[];
};

export default async function retrieveDatabaseStructure(): Promise<DatabaseSchema> {
    // Create a PostgreSQL client with credentials from .env
    if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_PASSWORD) {
        console.error('Missing required database environment variables: DB_USER, DB_HOST, DB_NAME, or DB_PASSWORD.');
        throw new Error('Database environment variables are not set. Please check DB_USER, DB_HOST, DB_NAME, and DB_PASSWORD in your .env file.');
    }

    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        ssl: {
            rejectUnauthorized: false // Allow self-signed certificates
        }
    });

    try {

        // console.log('Connecting to PostgreSQL database...');
        await client.connect();
        // console.log('Connection successful!');

        // Get all tables
        const tablesQuery = `
            SELECT tablename
            FROM pg_catalog.pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
        `;
        const tablesResult = await client.query(tablesQuery);
        const tables = tablesResult.rows.map(row => row.tablename);
        // console.log(`Found ${tables.length} tables in the database.`);

        // Get all views
        const viewsQuery = `
            SELECT viewname
            FROM pg_catalog.pg_views
            WHERE schemaname = 'public'
            ORDER BY viewname;
        `;
        const viewsResult = await client.query(viewsQuery);
        const views = viewsResult.rows.map(row => row.viewname);
        // console.log(`Found ${views.length} views in the database.`);

        // Get all functions
        const functionsQuery = `
            SELECT p.proname as function_name, pg_get_functiondef(p.oid) as function_definition
            FROM pg_proc p
                     JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            ORDER BY p.proname;
        `;
        const functionsResult = await client.query(functionsQuery);
        const functions = functionsResult.rows;
        // console.log(`Found ${functions.length} functions in the database.`);

        // Get all enums
        const enumsQuery = `
            SELECT pg_type.typname                                             as enum_name,
                   array_agg(pg_enum.enumlabel ORDER BY pg_enum.enumsortorder) as enum_values
            FROM pg_type
                     JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
                     JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
            WHERE pg_namespace.nspname = 'public'
            GROUP BY pg_type.typname
            ORDER BY pg_type.typname;
        `;
        const enumsResult = await client.query(enumsQuery);
        const enums = enumsResult.rows.map(row => ({
            enum_name: row.enum_name,
            enum_values: postgresArrayToStringArray(row.enum_values)
        }));
        // console.log(`Found ${enums.length} enums in the database:`, enums);

        // Get detailed schema information for each table
        const tableDetails: Record<string, {
            columns: DatabaseSchema['tables'][string]['columns'];
            primaryKeys: DatabaseSchema['tables'][string]['primaryKeys'];
            foreignKeys: DatabaseSchema['tables'][string]['foreignKeys'];
            indexes: DatabaseSchema['tables'][string]['indexes'];
        }> = {};
        for (const tableName of tables) {
            // Get column information
            const columnsQuery = `
                SELECT column_name,
                       data_type,
                       character_maximum_length,
                       is_nullable,
                       column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = $1
                ORDER BY ordinal_position;
            `;
            const columnsResult = await client.query(columnsQuery, [tableName]);
            // console.log(`Columns for table ${tableName}:`, columnsResult.rows);

            // Get primary key information
            const pkQuery = `
                SELECT c.column_name
                FROM information_schema.table_constraints tc
                         JOIN information_schema.constraint_column_usage AS c ON c.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_name = $1;
            `;
            const pkResult = await client.query(pkQuery, [tableName]);
            // console.log(`Primary keys for table ${tableName}:`, pkResult.rows);
            const primaryKeys = pkResult.rows.map(row => row.column_name);

            // Get foreign key information
            const fkQuery = `
                SELECT kcu.column_name,
                       ccu.table_name  AS foreign_table_name,
                       ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                         JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
                         JOIN information_schema.constraint_column_usage AS ccu
                              ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_name = $1;
            `;
            const fkResult = await client.query(fkQuery, [tableName]);
            // console.log(`Foreign keys for table ${tableName}:`, fkResult.rows);

            // Get indexes
            const indexesQuery = `
                SELECT indexname,
                       indexdef
                FROM pg_indexes
                WHERE tablename = $1;
            `;
            const indexesResult = await client.query(indexesQuery, [tableName]);
            // console.log(`Indexes for table ${tableName}:`, indexesResult.rows);

            // Store all collected information for this table
            tableDetails[tableName] = {
                columns: columnsResult.rows as DatabaseSchema['tables'][string]['columns'],
                primaryKeys: primaryKeys as DatabaseSchema['tables'][string]['primaryKeys'],
                foreignKeys: fkResult.rows as DatabaseSchema['tables'][string]['foreignKeys'],
                indexes: indexesResult.rows as DatabaseSchema['tables'][string]['indexes']
            };
        }

        // Get view definitions
        const viewDetails: Record<string, {
            definition: string;
            columns: DatabaseSchema['views'][string]['columns'];
        }> = {};
        for (const viewName of views) {
            const viewDefQuery = `SELECT pg_get_viewdef(to_regclass($1), true) AS view_definition;`;
            const viewDefResult = await client.query(viewDefQuery, [`public.${viewName}`]);
            // console.log(`View definition for ${viewName}:`, viewDefResult.rows[0]?.view_definition);

            // Get column information for the view
            const columnsQuery = `
                SELECT column_name,
                       data_type,
                       character_maximum_length,
                       is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = $1
                ORDER BY ordinal_position;
            `;
            const columnsResult = await client.query(columnsQuery, [viewName]);
            // console.log(`Columns for view ${viewName}:`, columnsResult.rows);

            viewDetails[viewName] = {
                definition: viewDefResult.rows[0].view_definition,
                columns: columnsResult.rows
            };
        }

        // Create a complete schema object
        return {
            tables: tableDetails,
            views: viewDetails,
            functions: functions,
            enums: enums
        };
    } catch (error) {
        console.error('Failed to retrieve database structure:', error);
        throw error;
    } finally {
        // Close the connection
        await client.end();
        // console.log('Database connection closed.');
    }
}

export async function formatSchemaAsMarkdown(schema: DatabaseSchema) : Promise<string> {
    let markdown = `# Database Structure\n\n`;
    try {

        // Add tables section
        markdown += `## Tables\n\n`;
        for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
            markdown += `### ${tableName}\n\n`;

            // Add columns table
            markdown += `#### Columns\n\n`;
            markdown += `| Column Name | Data Type | Nullable | Default | Primary Key |\n`;
            markdown += `|-------------|-----------|----------|---------|-------------|\n`;

            for (const column of tableInfo.columns) {
                const isPrimaryKey = tableInfo.primaryKeys.includes(column.column_name) ? 'Yes' : 'No';
                const dataType = column.character_maximum_length
                    ? `${column.data_type}(${column.character_maximum_length})`
                    : column.data_type;

                markdown += `| ${column.column_name} | ${dataType} | ${column.is_nullable === 'YES' ? 'Yes' : 'No'} | ${column.column_default || 'NULL'} | ${isPrimaryKey} |\n`;
            }

            // Add foreign keys section if any
            if (tableInfo.foreignKeys.length > 0) {
                markdown += `\n#### Foreign Keys\n\n`;
                markdown += `| Column | References Table | References Column |\n`;
                markdown += `|--------|------------------|-------------------|\n`;

                for (const fk of tableInfo.foreignKeys) {
                    markdown += `| ${fk.column_name} | ${fk.foreign_table_name} | ${fk.foreign_column_name} |\n`;
                }
            }

            // Add indexes section if any
            if (tableInfo.indexes.length > 0) {
                markdown += `\n#### Indexes\n\n`;
                markdown += `| Name | Definition |\n`;
                markdown += `|------|------------|\n`;

                for (const idx of tableInfo.indexes) {
                    markdown += `| ${idx.indexname} | ${idx.indexdef} |\n`;
                }
            }

            markdown += `\n`;
        }

        // Add views section
        if (Object.keys(schema.views).length > 0) {
            markdown += `## Views\n\n`;

            for (const [viewName, viewInfo] of Object.entries(schema.views)) {
                markdown += `### ${viewName}\n\n`;

                // Add definition
                markdown += `#### Definition\n\n`;
                markdown += "```sql\n";
                markdown += viewInfo.definition;
                markdown += "\n```\n\n";

                // Add columns
                markdown += `#### Columns\n\n`;
                markdown += `| Column Name | Data Type | Nullable |\n`;
                markdown += `|-------------|-----------|----------|\n`;

                for (const column of viewInfo.columns) {
                    const dataType = column.character_maximum_length
                        ? `${column.data_type}(${column.character_maximum_length})`
                        : column.data_type;

                    markdown += `| ${column.column_name} | ${dataType} | ${column.is_nullable === 'YES' ? 'Yes' : 'No'} |\n`;
                }

                markdown += `\n`;
            }
        }

        // Add enums section
        if (schema.enums.length > 0) {
            markdown += `## Enums\n\n`;

            for (const enumInfo of schema.enums) {
                markdown += `### ${enumInfo.enum_name}\n\n`;
                const enumeValues: string[] = enumInfo.enum_values;
                // console.log(enumeValues);
                markdown += `Values: ${enumeValues.join(', ')}\n\n`;
            }
        }

        // Add functions section
        if (schema.functions.length > 0) {
            markdown += `## Functions\n\n`;

            for (const funcInfo of schema.functions) {
                markdown += `### ${funcInfo.function_name}\n\n`;
                markdown += "```sql\n";
                markdown += funcInfo.function_definition;
                markdown += "\n```\n\n";
            }
        }

    } catch (error) {
        console.error('Failed to generate markdown schema:', error);
    }
    return markdown;
}