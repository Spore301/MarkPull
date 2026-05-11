#### You said:

Pasted markdown(1).md

D:\\Dev\\n8n>docker run -it --rm \\ What's next: Debug this container error with Gordon → docker ai "help me fix this container error" docker: invalid reference format Run 'docker run --help' for more information D:\\Dev\\n8n> --name n8n \\ '--name' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -p 5678:5678 \\ '-p' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -e GENERIC\_TIMEZONE="Asia/Kolkata" \\ '-e' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -e TZ="Asia/Kolkata" \\ '-e' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -e N8N\_ENFORCE\_SETTINGS\_FILE\_PERMISSIONS=true \\ '-e' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -e N8N\_RUNNERS\_ENABLED=true \\ '-e' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -v n8n\_data:/home/node/.n8n \\ '-v' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> docker volume create n8n\_data n8n\_data D:\\Dev\\n8n>docker run -it --rm \\ What's next: Debug this container error with Gordon → docker ai "help me fix this container error" docker: invalid reference format Run 'docker run --help' for more information D:\\Dev\\n8n> --name n8n \\ '--name' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -p 5678:5678 \\ '-p' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -e GENERIC\_TIMEZONE="Asia/Kolkata" \\ '-e' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -e TZ="Asia/Kolkata" \\ '-e' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -e N8N\_ENFORCE\_SETTINGS\_FILE\_PERMISSIONS=true \\ '-e' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -e N8N\_RUNNERS\_ENABLED=true \\ '-e' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> -v n8n\_data:/home/node/.n8n \\ '-v' is not recognized as an internal or external command, operable program or batch file. D:\\Dev\\n8n> docker.n8n.io/n8nio/n8n What do I do

#### ChatGPT said:

You’re using **Windows CMD**, but the command you copied uses `\` for line continuation, which works in **Linux/macOS shells**, not CMD.

That’s why CMD is treating each line as a separate command.

Run this instead as **ONE SINGLE LINE** in CMD:

Bash

```
docker run -it --rm --name n8n -p 5678:5678 -e GENERIC_TIMEZONE="Asia/Kolkata" -e TZ="Asia/Kolkata" -e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true -e N8N_RUNNERS_ENABLED=true -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

You already created the volume successfully:

Bash

```
docker volume create n8n_data
```

So now just run the single-line command above.

After it starts, open:

```
http://localhost:5678
```

and n8n should load.

The issue came from the Linux-style multiline command in the docs.

Pasted markdown

If you want multiline commands in Windows CMD, use `^` instead of `\`:

Bash

```
docker run -it --rm ^ --name n8n ^ -p 5678:5678 ^ -e GENERIC_TIMEZONE="Asia/Kolkata" ^ -e TZ="Asia/Kolkata" ^ -e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true ^ -e N8N_RUNNERS_ENABLED=true ^ -v n8n_data:/home/node/.n8n ^ docker.n8n.io/n8nio/n8n
```

If you use PowerShell, the multiline character is different again (\`\`\` backtick).

ChatGPT can make mistakes. Check important info. See Cookie Preferences.